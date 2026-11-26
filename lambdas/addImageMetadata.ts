
import { SNSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const handler: SNSHandler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  for (const record of event.Records) {
    const snsMessage = record.Sns;

    const attributeName =
      snsMessage.MessageAttributes.metadata_type.Value.toString();

    const message = JSON.parse(snsMessage.Message);

    console.log("Metadata type:", attributeName);
    console.log("Metadata message:", message);

    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        name: message.name,
      },
      UpdateExpression: "SET #attr = :value",
      ExpressionAttributeNames: {
        "#attr": attributeName,
      },
      ExpressionAttributeValues: {
        ":value": message.value,
      },
    };

    await ddbDocClient.send(new UpdateCommand(params));

    console.log(
      `Updated ${message.name}: ${attributeName} = ${message.value}`
    );
  }
};
