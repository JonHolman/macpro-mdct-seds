import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { Lambda } from "../local-constructs/lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface ApiStackProps extends cdk.NestedStackProps {
  project: string;
  stage: string;
  stack: string;
  isDev: boolean;
  tables: dynamodb.Table[];
}

export class ApiStack extends cdk.NestedStack {
  public readonly shortStackName: string;
  public readonly tables: dynamodb.Table[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext("stage") || "dev";

    const service = "app-api";
    this.shortStackName = `${service}-${stage}`;
    cdk.Tags.of(this).add("SERVICE", service);

    this.tables = props.tables;

    const environment = {
      stage,
      ...this.tables.reduce(
        (acc, table) => {
          const currentTable = cdk.Stack.of(table)
            .getLogicalId(table.node.defaultChild as cdk.CfnElement)
            .slice(0, -8);

          acc[`${currentTable}Name`] = table.tableName;
          acc[`${currentTable}Arn`] = table.tableArn;

          return acc;
        },
        {} as { [key: string]: string }
      ),
    };

    // DynamoDB permissions
    const dynamoDbTables = [
      "sls-age-ranges",
      "sls-form-answers",
      "sls-form-questions",
      "sls-forms",
      "sls-state-forms",
      "sls-states",
      "sls-status",
      "sls-auth-user",
      "sls-auth-user-roles",
      "sls-auth-user-states",
      "sls-form-templates",
    ];

    new Lambda(this, "test", {
      entry: "./lib/local-constructs/lambda/handler.ts",
      dynamoDbTables,
    });

    const api = new apigateway.RestApi(this, "ApiGatewayRestApi", {
      restApiName: `app-api-${stage}`,
      deploy: true,
      deployOptions: {
        stageName: stage,
      },
    });

    // Functions
    new Lambda(this, "getFormTypes", {
      entry: "services/app-api/handlers/forms/get/getFormTypes.js",
      dynamoDbTables,
      environment,
      api,
      path: "/form-types",
      method: "GET",
    });

    new Lambda(this, "generateQuarterForms", {
      entry: "services/app-api/handlers/forms/post/generateQuarterForms.js",
      dynamoDbTables,
      environment,
      api,
      path: "/generate-forms",
      method: "POST",
      timeout: cdk.Duration.minutes(15),
    });

    const generateQuarterFormsOnScheduleLambda = new Lambda(
      this,
      "generateQuarterFormsOnSchedule",
      {
        entry: "services/app-api/handlers/forms/post/generateQuarterForms.js",
        handler: "scheduled",
        dynamoDbTables,
        environment,
        timeout: cdk.Duration.minutes(15),
      }
    ).lambda;

    const rule = new events.Rule(this, "GenerateQuarterFormsOnScheduleRule", {
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "0",
        day: "1",
        month: "1,4,7,10",
      }),
    });
    rule.addTarget(
      new targets.LambdaFunction(generateQuarterFormsOnScheduleLambda)
    );

    //   #
    //   # NOTE: The SEDS business owners have requested that the email flow to users be disabled, but would like to be
    //   # able to re-enable it at a future point (see: https://bit.ly/3w3mVmT). For now, this handler will be commented out
    //   # and not removed.
    //   #
    //   # stateUsersEmail:
    //   #   handler: handlers/notification/stateUsers.main
    //   #   role: LambdaApiRole
    //   #   events:
    //   #     - http:
    //   #         path: notification/stateUsersEmail
    //   #         method: post
    //   #         cors: true
    //   #         authorizer: aws_iam
    //   #     - schedule:
    //   #         enabled: true
    //   #         rate: cron(0 0 1 */3 ? *)
    //   #
    //   # businessUsersEmail:
    //   #   handler: handlers/notification/businessUsers.main
    //   #   role: LambdaApiRole
    //   #   events:
    //   #     - http:
    //   #         path: notification/businessUsersEmail
    //   #         method: post
    //   #         cors: true
    //   #         authorizer: aws_iam
    //   #     - schedule:
    //   #         enabled: false
    //   #         rate: cron(0 0 1 */3 ? *)
    //   #
    //   # uncertified:
    //   #   handler: handlers/notification/uncertified.main
    //   #   role: LambdaApiRole
    //   #   events:
    //   #     - http:
    //   #         path: notification/uncertified
    //   #         method: post
    //   #         cors: true
    //   #         authorizer: aws_iam
    //   #

    new Lambda(this, "saveForm", {
      entry: "services/app-api/handlers/forms/post/saveForm.js",
      dynamoDbTables,
      environment,
      api,
      path: "/single-form/save",
      method: "POST",
    });

    new Lambda(this, "getFormTemplate", {
      entry:
        "services/app-api/handlers/form-templates/post/obtainFormTemplate.js",
      dynamoDbTables,
      environment,
      api,
      path: "/form-template",
      method: "POST",
    });

    new Lambda(this, "getFormTemplateYears", {
      entry:
        "services/app-api/handlers/form-templates/post/obtainFormTemplateYears.js",
      dynamoDbTables,
      environment,
      api,
      path: "/form-templates/years",
      method: "POST",
    });

    new Lambda(this, "updateCreateFormTemplate", {
      entry:
        "services/app-api/handlers/form-templates/post/updateCreateFormTemplate.js",
      dynamoDbTables,
      environment,
      api,
      path: "/form-templates/add",
      method: "POST",
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });
  }
}
