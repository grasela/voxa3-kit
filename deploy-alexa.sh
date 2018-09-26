#!/usr/bin/env bash
set -euo pipefail
set -o xtrace


declare -a LOCALES=("en-us" "en-ca" "en-au" "en-gb" "en-in")

if [ "$GIT_BRANCH" == "origin/production" ] ;
then
  export NODE_ENV=production
  export INTERACTION_MODEL=speech-assets/alexa/en-US/production-model.json
  export SKILL_ID=
  export SKILL_MANIFEST=speech-assets/alexa/production-skill.json
elif [ "$GIT_BRANCH" == "origin/staging" ] ;
then
  export NODE_ENV=staging
  export INTERACTION_MODEL=speech-assets/alexa/en-US/staging-model.json
  export SKILL_ID=
  export SKILL_MANIFEST=speech-assets/alexa/staging-skill.json
fi

for LOCALE in "${LOCALES[@]}"
do
  echo "Updating: $LOCALE"
  npx ask api update-model --file $INTERACTION_MODEL  --skill-id $SKILL_ID --locale "$LOCALE"
done

npx ask api update-skill --skill-id $SKILL_ID -f $SKILL_MANIFEST
