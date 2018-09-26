#!/usr/bin/env bash
set -euo pipefail
set -o xtrace

if [ "$GIT_BRANCH" == "origin/production" ] ;
then
  export NODE_ENV=production
  export ASSISTANT_MODEL=production
  export PROJECT_ID=nib-health-production
elif [ "$GIT_BRANCH" == "origin/staging" ] ;
then
  export NODE_ENV=staging
  export PROJECT_ID=nib-health-staging
  export ASSISTANT_MODEL=staging
fi

gcloud auth activate-service-account --key-file=dialogFlow_key.json

cd speech-assets/dialog-flow/$ASSISTANT_MODEL

# fix for an error in the voxa-cli
find ./ -type f -exec sed -i -e 's/@sys-duration/@sys.duration/g' {} \;

rm --force "$ASSISTANT_MODEL.zip"
zip --recurse-paths "$ASSISTANT_MODEL.zip" "./"

AGENT_CONTENT="$(base64 -w 0 $ASSISTANT_MODEL.zip)"
AUTHORIZATION=$(gcloud auth print-access-token)
http --ignore-stdin --timeout 60 --json POST "https://dialogflow.googleapis.com/v2/projects/$PROJECT_ID/agent:restore" agentContent="$AGENT_CONTENT" "Authorization:Bearer $AUTHORIZATION"
