#!/usr/bin/env bash
set -euo pipefail
set -o xtrace

if [ "$GIT_BRANCH" == "origin/production" ] ;
then
  export NODE_ENV=production
elif [ "$GIT_BRANCH" == "origin/staging" ] ;
then
  export NODE_ENV=staging
fi

npx sls deploy --stage $NODE_ENV
