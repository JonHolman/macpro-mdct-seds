import { Construct } from "constructs";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
// import { join } from "path";
import { Duration, RemovalPolicy, Stack, CfnElement } from "aws-cdk-lib";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { commonBundlingOptions } from "../../config/bundling-config";
import { ApiStack } from "../../stacks/api";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

interface LambdaProps extends Partial<NodejsFunctionProps> {
  entry: string;
  handler?: string;
  timeout?: Duration;
  memorySize?: number;
  policyStatements?: PolicyStatement[];
  managedPolicies?: string[];
  dynamoDbTables?: string[];
  environment?: { [key: string]: string };
  path?: string;
  method?: string;
}

// interface DynamoDBTableProps {
//   readonly name: string;
//   readonly partitionKey: { name: string; type: dynamodb.AttributeType };
//   readonly gsi?: {
//     indexName: string;
//     partitionKey: { name: string; type: dynamodb.AttributeType };
//   };
// }

export class Lambda extends Construct {
  public readonly lambda: NodejsFunction;
  public readonly logGroup: LogGroup;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    const {
      entry,
      handler = "main",
      timeout = Duration.seconds(6),
      memorySize = 1024,
      policyStatements = [],
      managedPolicies = ["service-role/AWSLambdaVPCAccessExecutionRole"],
      dynamoDbTables = [],
      path,
      method,
      ...restProps
    } = props;

    this.logGroup = new LogGroup(this, `${id}LogGroup`, {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stage = this.node.tryGetContext("stage") || "dev";

    // TODO: need to get broker string
    // const { brokerString } =
    console.log("TODO: parent:", Stack.of(this).nestedStackParent);

    const environment = {
      // BOOTSTRAP_BROKER_STRING_TLS: brokerString,
      STAGE: stage,
      stage,
      ...(Stack.of(this) as ApiStack).tables.reduce(
        (acc, table) => {
          const currentTable = Stack.of(table)
            .getLogicalId(table.node.defaultChild as CfnElement)
            .slice(0, -8);

          acc[`${currentTable}Name`] = table.tableName;
          acc[`${currentTable}Arn`] = table.tableArn;

          return acc;
        },
        {} as { [key: string]: string }
      ),
    };

    const role = new Role(this, `${id}LambdaExecutionRole`, {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: managedPolicies.map((policy) =>
        ManagedPolicy.fromAwsManagedPolicyName(policy)
      ),
      inlinePolicies: {
        LambdaPolicy: new PolicyDocument({
          statements: [
            ...policyStatements,
            new PolicyStatement({
              effect: Effect.DENY,
              actions: ["logs:CreateLogGroup"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // Add permissions to Lambda role
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
      })
    );

    // TOOD: instead of this being one policy per table, put all of the tables in one policy in the resources key
    (Stack.of(this) as ApiStack).tables.forEach((table) => {
      role.addToPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "dynamodb:DescribeTable",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:BatchWriteItem",
          ],
          resources: [table.tableArn],
        })
      );
    });

    this.lambda = new NodejsFunction(this, id, {
      functionName: `${(Stack.of(this) as ApiStack).shortStackName}-${id}`,
      entry,
      handler,
      runtime: Runtime.NODEJS_20_X,
      timeout,
      memorySize,
      //   depsLockFilePath: join(__dirname, "../../../bun.lockb"),
      logGroup: this.logGroup,
      role,
      bundling: commonBundlingOptions,

      environment,

      ...restProps,
    });

    if (path && method) {
      const resource = (Stack.of(this) as ApiStack).api.root.resourceForPath(
        path
      );
      resource.addMethod(
        method,
        new apigateway.LambdaIntegration(this.lambda),
        {
          authorizationType: apigateway.AuthorizationType.IAM,
        }
      );
    }
  }
}
