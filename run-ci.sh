#!/usr/bin/env bash
set -euo pipefail
set -o xtrace

yarn run lint --color
yarn run test-ci --reporter-options mochaFile=./reports/test-results.xml
yarn run coverage --report-dir reports/
yarn run coverage --reporter lcov --report-dir reports/
yarn run coverage --reporter cobertura --report-dir reports/
