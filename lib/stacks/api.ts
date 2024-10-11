import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { Lambda } from "../local-constructs/lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";

interface ApiStackProps extends cdk.NestedStackProps {
  project: string;
  stage: string;
  stack: string;
  isDev: boolean;
  tables: { [name: string]: dynamodb.Table };
  vpc: ec2.IVpc;
}

export class ApiStack extends cdk.NestedStack {
  public readonly shortStackName: string;
  public readonly tables: { [name: string]: dynamodb.Table };
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext("stage") || "dev";

    const service = "app-api";
    this.shortStackName = `${service}-${stage}`;
    cdk.Tags.of(this).add("SERVICE", service);

    this.tables = props.tables;

    const { vpc } = props;

    const vpcSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED };

    const kafkaSecurityGroup = new ec2.SecurityGroup(
      this,
      "KafkaSecurityGroup",
      {
        vpc,
        description:
          "Security Group for streaming functions. Egress all is set by default.",
        allowAllOutbound: true,
      }
    );

    const logGroup = new LogGroup(this, "ApiAccessLogs", {
      logGroupName: `/aws/api-gateway/${stage}-app-api`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, "ApiGatewayRestApi", {
      restApiName: `${stage}-app-api`,
      deploy: true,
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: false,
        throttlingBurstLimit: 5000,
        throttlingRateLimit: 10000.0,
        cachingEnabled: false,
        cacheTtl: cdk.Duration.seconds(300),
        cacheDataEncrypted: false,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          "requestId: $context.requestId, ip: $context.identity.sourceIp, " +
            "caller: $context.identity.caller, user: $context.identity.user, " +
            "requestTime: $context.requestTime, httpMethod: $context.httpMethod, " +
            "resourcePath: $context.resourcePath, status: $context.status, " +
            "protocol: $context.protocol, responseLength: $context.responseLength"
        ),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    this.api.addGatewayResponse("Default4XXResponse", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
      },
    });

    this.api.addGatewayResponse("Default5XXResponse", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'*'",
      },
    });

    new Lambda(this, "ForceKafkaSync", {
      entry: "services/app-api/handlers/kafka/get/forceKafkaSync.js",
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008, // TODO: 3072,
    });

    const postKafkaData = new Lambda(this, "postKafkaData", {
      entry: "services/app-api/handlers/kafka/post/postKafkaData.js",
      handler: "handler",
      timeout: cdk.Duration.seconds(120),
      memorySize: 2048,
      retryAttempts: 2,
      vpc,
      vpcSubnets,
      securityGroups: [kafkaSecurityGroup],
    });

    for (const table in this.tables) {
      let startingPosition = StartingPosition.TRIM_HORIZON;
      if (["auth-user-roles", "auth-user-states"].includes(table)) {
        startingPosition = StartingPosition.LATEST;
      }
      postKafkaData.lambda.addEventSource(
        new DynamoEventSource(this.tables[table], {
          startingPosition,
          retryAttempts: 2,
          enabled: true,
        })
      );
    }

    const dataConnectSource = new Lambda(this, "dataConnectSource", {
      entry: "services/app-api/handlers/kafka/post/dataConnectSource.js",
      handler: "handler",
      timeout: cdk.Duration.seconds(120),
      memorySize: 2048,
      retryAttempts: 2,
      vpc,
      vpcSubnets,
      securityGroups: [kafkaSecurityGroup],
    });

    for (const table in this.tables) {
      if (
        [
          "form-questions",
          "auth-user",
          "state-forms",
          "forms",
          "form-templates",
          "status",
          "states",
          "age-ranges",
          "form-answers",
        ].includes(table)
      ) {
        dataConnectSource.lambda.addEventSource(
          new DynamoEventSource(this.tables[table], {
            startingPosition: StartingPosition.TRIM_HORIZON,
            retryAttempts: 2,
            enabled: true,
          })
        );
      }
    }

    new Lambda(this, "exportToExcel", {
      entry: "services/app-api/export/exportToExcel.js",
      path: "/export/export-to-excel",
      method: "POST",
    });

    new Lambda(this, "getUserById", {
      entry: "services/app-api/handlers/users/get/getUserById.js",
      path: "/users/{id}",
      method: "GET",
    });

    new Lambda(this, "getUsers", {
      entry: "services/app-api/handlers/users/get/listUsers.js",
      path: "/users",
      method: "GET",
    });

    new Lambda(this, "obtainUserByUsername", {
      entry: "services/app-api/handlers/users/post/obtainUserByUsername.js",
      path: "/users/get",
      method: "POST",
    });

    new Lambda(this, "obtainUserByEmail", {
      entry: "services/app-api/handlers/users/post/obtainUserByEmail.js",
      path: "/users/get/email",
      method: "POST",
    });

    new Lambda(this, "createUser", {
      entry: "services/app-api/handlers/users/post/createUser.js",
      path: "/users/add",
      method: "POST",
    });

    new Lambda(this, "adminCreateUser", {
      entry: "services/app-api/handlers/users/post/createUser.js",
      handler: "adminCreateUser",
      path: "/users/admin-add",
      method: "POST",
    });

    new Lambda(this, "deleteUser", {
      entry: "services/app-api/handlers/users/post/deleteUser.js",
    });

    new Lambda(this, "updateUser", {
      entry: "services/app-api/handlers/users/post/updateUser.js",
      path: "/users/update/{userId}",
      method: "POST",
    });

    new Lambda(this, "getForm", {
      entry: "services/app-api/handlers/forms/get.js",
      path: "/single-form/{state}/{specifiedYear}/{quarter}/{form}",
      method: "GET",
    });

    new Lambda(this, "getStateFormList", {
      entry: "services/app-api/handlers/forms/post/obtainFormsList.js",
      path: "/forms/obtain-state-forms",
      method: "POST",
    });

    new Lambda(this, "updateStateFormList", {
      entry: "services/app-api/handlers/state-forms/post/updateStateForms.js",
      path: "/state-forms/update",
      method: "POST",
    });

    new Lambda(this, "generateEnrollmentTotals", {
      entry:
        "services/app-api/handlers/state-forms/post/generateEnrollmentTotals.js",
      path: "/generate-enrollment-totals",
      // async: true // TODO: figure out how to represent the equivalent of that in CDK // confirmed the lambda config matches.
      method: "POST",
      timeout: cdk.Duration.minutes(15),
    });

    new Lambda(this, "obtainAvailableForms", {
      entry: "services/app-api/handlers/forms/post/obtainAvailableForms.js",
      path: "/forms/obtainAvailableForms",
      method: "POST",
    });

    new Lambda(this, "getFormTypes", {
      entry: "services/app-api/handlers/forms/get/getFormTypes.js",
      path: "/form-types",
      method: "GET",
    });

    new Lambda(this, "generateQuarterForms", {
      entry: "services/app-api/handlers/forms/post/generateQuarterForms.js",
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
      path: "/single-form/save",
      method: "POST",
    });

    new Lambda(this, "getFormTemplate", {
      entry:
        "services/app-api/handlers/form-templates/post/obtainFormTemplate.js",
      path: "/form-template",
      method: "POST",
    });

    new Lambda(this, "getFormTemplateYears", {
      entry:
        "services/app-api/handlers/form-templates/post/obtainFormTemplateYears.js",
      path: "/form-templates/years",
      method: "POST",
    });

    new Lambda(this, "updateCreateFormTemplate", {
      entry:
        "services/app-api/handlers/form-templates/post/updateCreateFormTemplate.js",
      path: "/form-templates/add",
      method: "POST",
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiGatewayRestApiUrl", {
      value: this.api.url,
    });
    new cdk.CfnOutput(this, "ApiGatewayRestApiName", {
      value: this.api.restApiName,
    });
    new cdk.CfnOutput(this, "Region", {
      value: this.region,
    });
  }
}
