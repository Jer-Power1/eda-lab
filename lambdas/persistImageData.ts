
import { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    console.log("Record body ", JSON.stringify(snsMessage));

    if (snsMessage.Records) {
      for (const s3Message of snsMessage.Records) {
        const s3e = s3Message.s3;

        const srcKey = decodeURIComponent(
          s3e.object.key.replace(/\+/g, " ")
        );

        // Check that the file has a supported image extension
        const extensionMatch = srcKey.match(/\.([^.]*)$/);
        const fileExtension = extensionMatch
          ? extensionMatch[1].toLowerCase()
          : "";

        if (!["jpeg", "jpg", "png"].includes(fileExtension)) {
          console.log("Invalid image file type:", srcKey);
          throw new Error(`Unsupported file type: ${srcKey}`);
        }

        // Save valid image filename to DynamoDB
        try {
          await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.TABLE_NAME,
              Item: {
                name: srcKey,
              },
            })
          );

          console.log("Saved image to DynamoDB:", srcKey);
        } catch (error) {
          console.log("DynamoDB error:", error);
          throw error;
        }
      }
    }
  }
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
