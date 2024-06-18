import handler from "../../../libs/handler-lib";
import dynamoDb from "../../../libs/dynamodb-lib";
import { authorizeAnyUser } from "../../../auth/authConditions";

export const main = handler(async (event, context) => {
  await authorizeAnyUser(event);

  const params = {
    TableName: process.env.FormsTableName,
    Select: "ALL_ATTRIBUTES",
  };

  const result = await dynamoDb.scan(params);

  return result.Items;
});
