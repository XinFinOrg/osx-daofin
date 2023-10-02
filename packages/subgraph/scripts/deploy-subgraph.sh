#!/usr/bin/env bash

if [ -f .env ]
then
  export $(cat .env | sed 's/#.*//g' | xargs)
fi

if [ -z "$NETWORK_NAME" ] || [ -z "$SUBGRAPH_NAME" ] || [ -z "$GRAPH_KEY" ] || [ -z "$SUBGRAPH_VERSION" ]
then
    echo "env variables are not set properly, exiting..."
    exit -1
fi

# Exit script as soon as a command fails.
set -o errexit

# Build manifest
echo ''
echo '> Building manifest file subgraph.yaml'
./scripts/build-manifest.sh

# Build subgraph
echo ''
echo '> Building subgraph'
./scripts/build-subgraph.sh

if [ "$NETWORK_NAME" == 'anvil' ]
then
  NETWORK_NAME='apothem'
fi

# Prepare subgraph name
FULLNAME=$SUBGRAPH_NAME-$NETWORK_NAME
if [ "$STAGING" ]; then
  FULLNAME=$FULLNAME-staging
fi
echo ''
echo '> Deploying subgraph: '$FULLNAME
echo '> Subgraph version: '$SUBGRAPH_VERSION

# Deploy subgraph
graph deploy $FULLNAME \
        --ipfs http://localhost:5001 \
        --node http://localhost:8020
