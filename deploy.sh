#!/usr/bin/env bash
set -euo pipefail
set -o xtrace

./deploy-aws.sh
./deploy-alexa.sh
# ./deploy-assistant.sh

