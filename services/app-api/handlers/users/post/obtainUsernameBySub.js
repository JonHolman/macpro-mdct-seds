import handler from "../../../libs/handler-lib";
import dynamoDb from "../../../libs/dynamodb-lib";

export const main = handler(async (event, context) => {
  let data = JSON.parse(event.body);
  console.log("\n\n\n---->about to obtain user: ");
  console.log(data);

  const params = {
    TableName:
      process.env.AUTH_USER_TABLE_NAME ?? process.env.AuthUserTableName,
    Select: "ALL_ATTRIBUTES",
    ExpressionAttributeValues: {
      ":usernameSub": data.usernameSub,
    },
    FilterExpression: "usernameSub = :usernameSub",
  };

  const result = await dynamoDb.scan(params);

  console.log("\n\nresult of scan ~~~~>");
  console.log(result);

  if (result.Count === 0) {
    return false;
  }

  console.log("\n\n\n=-========>user obtained: ");
  console.log(result);

  // Return the retrieved item
  return result;
});
