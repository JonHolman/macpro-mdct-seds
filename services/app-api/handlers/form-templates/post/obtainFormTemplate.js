import handler from "../../../libs/handler-lib";
import dynamoDb from "../../../libs/dynamodb-lib";
import { authorizeAdmin } from "../../../auth/authConditions";

/**
 * Returns a single form template
 * This can be used for generating form Answers and Questions
 */

export const main = handler(async (event, context) => {
  await authorizeAdmin(event);

  let data = JSON.parse(event.body);

  const params = {
    TableName:
      process.env.FORM_TEMPLATES_TABLE_NAME ??
      process.env.FormTemplatesTableName,
    // IndexName: "year",
    ExpressionAttributeNames: {
      "#theYear": "year",
    },
    ExpressionAttributeValues: {
      ":year": parseInt(data.year),
    },
    KeyConditionExpression: "#theYear = :year",
  };

  const result = await dynamoDb.query(params);
  if (result.Count === 0) {
    return {
      status: 404,
      message: `Could not find form template for year: ${data.year}`,
    };
  }
  // Return the matching list of items in response body
  return result.Items;
});
