import yargs from "yargs";
import * as dotenv from "dotenv";
import LabeledProcessRunner from "./runner.js";
import { ServerlessStageDestroyer } from "@stratiformdigital/serverless-stage-destroyer";
import { execSync } from "child_process";
import * as readlineSync from "readline-sync";
import {
  CloudFormationClient,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} from "@aws-sdk/client-cloudformation";

// load .env
dotenv.config();

const deployedServices = [
  "database",
  "app-api",
  "stream-functions",
  "ui-waflog-s3-bucket",
  "ui",
  "ui-auth",
  "ui-waf-log-assoc",
  "ui-src",
];

function confirmDestroyCommand(stack) {
  const orange = "\x1b[38;5;208m";
  const reset = "\x1b[0m";

  const confirmation = readlineSync.question(`
${orange}********************************* STOP *******************************
You've requested a destroy for: 

    ${stack}

Continuing will irreversibly delete all data and infrastructure
associated with ${stack} and its nested stacks.

Do you really want to destroy it?
Re-enter the stack name (${stack}) to continue:
**********************************************************************${reset}
`);

  if (confirmation !== stack) {
    throw new Error(`
${orange}**********************************************************************
The destroy operation has been aborted.
**********************************************************************${reset}
`);
  }
}

// Function to update .env files using 1Password CLI
function updateEnvFiles() {
  try {
    execSync("op inject -i .env.tpl -o .env -f", { stdio: "inherit" });
    execSync("sed -i '' -e 's/# pragma: allowlist secret//g' .env");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to update .env files using 1Password CLI.");
    process.exit(1);
  }
}

// run_db_locally runs the local db
// @ts-ignore
async function run_db_locally(runner: LabeledProcessRunner) {
  await runner.run_command_and_output(
    "db yarn",
    ["yarn", "install"],
    "services/database"
  );
  await runner.run_command_and_output(
    "db svls",
    ["serverless", "dynamodb", "install", "--stage=local"],
    "services/database"
  );
  await runner.run_command_and_output(
    "db svls doc",
    ["serverless", "doctor"],
    "services/database"
  );
  runner.run_command_and_output(
    "db",
    ["serverless", "dynamodb", "start", "--stage=local", "--migrate"],
    "services/database"
  );
}

// run_api_locally uses the serverless-offline plugin to run the api lambdas locally
// @ts-ignore
async function run_api_locally(runner: LabeledProcessRunner) {
  await runner.run_command_and_output(
    "api deps",
    ["yarn", "install"],
    "services/app-api"
  );
  await runner.run_command_and_output(
    "api svls doc",
    ["serverless", "doctor"],
    "services/app-api"
  );
  runner.run_command_and_output(
    "api",
    [
      "serverless",
      "offline",
      "start",
      "--stage",
      "local",
      "--region",
      "us-east-1",
      "--httpPort",
      "3030",
    ],
    "services/app-api"
  );
}

// run_fe_locally runs the frontend and its dependencies locally
// @ts-ignore
async function run_fe_locally(runner: LabeledProcessRunner) {
  await runner.run_command_and_output(
    "ui deps",
    ["yarn", "install"],
    "services/ui-src"
  );
  await runner.run_command_and_output(
    "ui svls doc",
    ["serverless", "doctor"],
    "services/ui-src"
  );
  await runner.run_command_and_output(
    "ui conf",
    ["./env.sh", "local"],
    "services/ui-src"
  );

  runner.run_command_and_output("ui", ["npm", "start"], "services/ui-src");
}

// run_all_locally runs all of our services locally
async function run_all_locally() {
  const runner = new LabeledProcessRunner();

  run_db_locally(runner);
  run_api_locally(runner);
  run_fe_locally(runner);
}

async function seed_database(runner: LabeledProcessRunner, stage: string) {
  const seedService = "data-deployment";
  await install_deps(runner, seedService);
  const seedDeployCmd = ["sls", "deploy", "--stage", stage];
  // Deploy seed service
  await runner.run_command_and_output(
    "Seed service deploy",
    seedDeployCmd,
    `services/${seedService}`
  );
  // Run seed
  const seedCmd = ["sls", "dynamodb:seed", "--stage", stage];
  await runner.run_command_and_output(
    "Run seed",
    seedCmd,
    `services/${seedService}`
  );
}

async function install_deps(runner: LabeledProcessRunner, service: string) {
  await runner.run_command_and_output(
    "Installing dependencies",
    ["yarn", "install", "--frozen-lockfile"],
    `services/${service}`
  );
}

async function prepare_services(runner: LabeledProcessRunner) {
  for (const service of deployedServices) {
    await install_deps(runner, service);
  }
}

async function deploy(options: { stage: string }) {
  const stage = options.stage;
  const runner = new LabeledProcessRunner();
  await prepare_services(runner);
  const deployCmd = ["sls", "deploy", "--stage", stage];
  await runner.run_command_and_output("Serverless deploy", deployCmd, ".");
  // Seed when flag is set to true
  if (process.env.SEED_DATABASE) {
    await seed_database(runner, stage);
  }
}

async function cdkDeploy(options: { stage: string }) {
  const stage = options.stage;
  const runner = new LabeledProcessRunner();
  await prepare_services(runner);
  const deployCmd = ["cdk", "deploy", "-c", `stage=${stage}`, "--all"];
  await runner.run_command_and_output("CDK deploy", deployCmd, ".");
  // Seed when flag is set to true
  if (process.env.SEED_DATABASE) {
    await seed_database(runner, stage);
  }

  // TODO: do we need to build and deploy react separately?  If so, this is what mako did:
  // await runCommand("bun", ["run", "build"], "react-app");

  // const buildDir = path.join(__dirname, "../../../react-app", "dist");

  // try {
  //   execSync(`find ${buildDir} -type f -exec touch -t 202001010000 {} +`);
  // } catch (error) {
  //   console.error("Failed to set fixed timestamps:", error);
  // }

  // // There's a mime type issue when aws s3 syncing files up
  // // Empirically, this issue never presents itself if the bucket is cleared just before.
  // // Until we have a neat way of ensuring correct mime types, we'll remove all files from the bucket.
  // await runCommand(
  //   "aws",
  //   ["s3", "rm", `s3://${s3BucketName}/`, "--recursive"],
  //   "."
  // );
  // await runCommand(
  //   "aws",
  //   ["s3", "sync", buildDir, `s3://${s3BucketName}/`],
  //   "."
  // );

  // console.log(
  //   `Deployed UI to S3 bucket ${s3BucketName} and invalidated CloudFront distribution ${cloudfrontDistributionId}`
  // );
}

const waitForStackDeleteComplete = async (
  client: CloudFormationClient,
  stackName: string
) => {
  return waitUntilStackDeleteComplete(
    { client, maxWaitTime: 3600 },
    { StackName: stackName }
  );
};

async function cdkDestroy({
  stage,
  wait,
  verify,
}: {
  stage: string;
  wait: boolean;
  verify: boolean;
}) {
  const stackName = `${project}-${stage}`;

  if (/prod/i.test(stage)) {
    console.log("Error: Destruction of production stages is not allowed.");
    process.exit(1);
  }

  if (verify) await confirmDestroyCommand(stackName);

  const client = new CloudFormationClient({ region });
  await client.send(new DeleteStackCommand({ StackName: stackName }));
  console.log(`Stack ${stackName} delete initiated.`);

  if (wait) {
    console.log(`Waiting for stack ${stackName} to be deleted...`);
    const result = await waitForStackDeleteComplete(client, stackName);
    console.log(
      result.state === "SUCCESS"
        ? `Stack ${stackName} deleted successfully.`
        : `Error: Stack ${stackName} deletion failed.`
    );
  } else {
    console.log(
      `Stack ${stackName} delete initiated. Not waiting for completion as --wait is set to false.`
    );
  }
}

async function destroy_stage(options: {
  stage: string;
  service: string | undefined;
  wait: boolean;
  verify: boolean;
}) {
  let destroyer = new ServerlessStageDestroyer();
  let filters = [
    {
      Key: "PROJECT",
      Value: `${process.env.PROJECT}`,
    },
  ];
  if (options.service) {
    filters.push({
      Key: "SERVICE",
      Value: `${options.service}`,
    });
  }

  await destroyer.destroy(`${process.env.REGION_A}`, options.stage, {
    wait: options.wait,
    filters: filters,
    verify: options.verify,
  });
}

// The command definitons in yargs
// All valid arguments to dev should be enumerated here, this is the entrypoint to the script
yargs(process.argv.slice(2))
  .command("local", "run system locally", {}, () => {
    run_all_locally();
  })
  .command(
    "test",
    "run all tests",
    () => {},
    () => {
      console.log("Testing 1. 2. 3.");
    }
  )
  .command(
    "deploy",
    "deploy the app with serverless compose to the cloud",
    {
      stage: { type: "string", demandOption: true },
    },
    deploy
  )
  .command(
    "cdkDeploy",
    "deploy the app with cdk to the cloud",
    {
      stage: { type: "string", demandOption: true },
    },
    cdkDeploy
  )
  .command(
    "cdkDestroy",
    "destroy a cdk stage in AWS",
    {
      stage: { type: "string", demandOption: true },
      service: { type: "string", demandOption: false },
      wait: { type: "boolean", demandOption: false, default: true },
      verify: { type: "boolean", demandOption: false, default: true },
    },
    cdkDestroy
  )
  .command(
    "destroy",
    "destroy serverless stage",
    {
      stage: { type: "string", demandOption: true },
      service: { type: "string", demandOption: false },
      wait: { type: "boolean", demandOption: false, default: true },
      verify: { type: "boolean", demandOption: false, default: true },
    },
    destroy_stage
  )
  .command(
    "update-env",
    "update environment variables using 1Password",
    () => {},
    () => {
      updateEnvFiles();
    }
  )
  .scriptName("run")
  .strict()
  .demandCommand(1, "").argv; // this prints out the help if you don't call a subcommand
