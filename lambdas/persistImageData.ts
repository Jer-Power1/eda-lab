
import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const recordBody = JSON.parse(record.body);
      const snsMessage = JSON.parse(recordBody.Message);

      console.log("Record body ", JSON.stringify(snsMessage));

      if (!Array.isArray(snsMessage.Records)) {
        throw new Error("No S3 records found in SNS message");
      }

      for (const s3Message of snsMessage.Records) {
        const s3e = s3Message.s3;

        const srcKey = decodeURIComponent(
          s3e.object.key.replace(/\+/g, " ")
        );

        // Validate the uploaded file extension
        const extensionMatch = srcKey.match(/\.([^.]*)$/);
        const fileExtension = extensionMatch
          ? extensionMatch[1].toLowerCase()
          : "";

        if (!["jpeg", "jpg", "png"].includes(fileExtension)) {
          console.log("Invalid image file type:", srcKey);
          throw new Error(`Unsupported file type: ${srcKey}`);
        }

        // Save valid image to DynamoDB
        await ddbDocClient.send(
          new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              name: srcKey,
            },
          })
        );

        console.log("Saved image to DynamoDB:", srcKey);
      }
    } catch (error) {
      console.log(
        "Failed to process SQS record:",
        record.messageId,
        error
      );

      // Report only the failed SQS message
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  console.log("Batch failures:", JSON.stringify(batchItemFailures));

  return {
    batchItemFailures,
  };
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({
    region: process.env.REGION,
  });

  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };

  const unmarshallOptions = {
    wrapNumbers: false,
  };

  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions,
    unmarshallOptions,
  });
}
