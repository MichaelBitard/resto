#!/bin/bash
#
# Copyright 2018 Jérôme Gasperi
#
# Licensed under the Apache License, version 2.0 (the "License");
# You may not use this file except in compliance with the License.
# You may obtain a copy of the License at:
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

###### DO NOT TOUCH DEFAULT VALUES ########
DATABASE_NAME=resto
DATABASE_USER_NAME=resto
DATABASE_USER_PASSWORD=resto
DATABASE_EXPOSED_PORT=5253
USERNAME=
PASSWORD=
GROUP=100
ID=
###########################################

# Force script to exit on error
set -e
err_report() {
    echo -e "${RED}[ERROR] Error - user not created${NC}"
}
trap 'err_report' ERR

ENV_FILE=__NULL__
function showUsage {
    echo ""
    echo "   Create admin user for resto instance"
    echo ""
    echo "   Usage $0 -e config.env -u username -p password -g group -i identifier"
    echo ""
    echo "      -e | --envfile Environnement file (see config.env example)"
    echo "      -u | --username Username (mandatory) "
    echo "      -p | --password Password (mandatory)"
    echo "      -g | --group Group id (default 100)"
    echo "      -i | --id Force user identifier"
    echo "      -h | --help show this help"
    echo ""
    echo "      !!! This script requires docker !!!"
    echo ""
}

# Parsing arguments
while [[ $# > 0 ]]
do
	key="$1"
	case $key in
        -e|--envfile)
            ENV_FILE="$2"
            shift # past argument
            ;;
        -u|--username)
            USERNAME="$2"
            shift # past argument
            ;;
        -p|--password)
            PASSWORD="$2"
            shift # past argument
            ;;
        -g|--group)
            GROUP="$2"
            shift # past argument
            ;;
        -i|--id)
            ID="$2"
            shift # past argument
            ;;
        -h|--help)
            showUsage
            exit 0
            shift # past argument
            ;;
            *)
        shift # past argument
        # unknown option
        ;;
	esac
done

#
# Check mandatory tools
#
if ! command -v psql &> /dev/null
then
    echo -e "${RED}[ERROR]${NC} The required \"psql\" command was not found. Please install postgresql-client package before running this script."
    echo ""
    exit 1
fi
if ! command -v docker &> /dev/null
then
    echo -e "${RED}[ERROR]${NC} The required \"docker\" command was not found. See https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

if [ ! -f ${ENV_FILE} ]; then
    showUsage
    echo -e "${RED}[ERROR]${NC} Missing or invalid config file!"
    echo ""
    exit 0
fi

if [ -z "${USERNAME}" ]; then
    showUsage
    echo -e "${RED}[ERROR]${NC} Missing username !"
    echo ""
    exit 0
fi

if [ -z "${PASSWORD}" ]; then
    showUsage
    echo -e "${RED}[ERROR]${NC} Missing password !"
    echo ""
    exit 0
fi

# Read environment from ENV_FILE
DATABASE_EXPOSED_PORT=$(grep ^DATABASE_EXPOSED_PORT= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)
DATABASE_USER_PASSWORD=$(grep ^DATABASE_USER_PASSWORD= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)
DATABASE_USER_NAME=$(grep ^DATABASE_USER_NAME= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)
DATABASE_NAME=$(grep ^DATABASE_NAME= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)
DATABASE_COMMON_SCHEMA=$(grep ^DATABASE_COMMON_SCHEMA= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)
DATABASE_HOST=$(grep ^DATABASE_HOST= ${ENV_FILE} | awk -F= '{for (i=2; i<=NF; i++) print $i}'| xargs echo -n)

# Change password !!!
echo -e "[INFO] Hashing password for secured storage"
HASH=`docker run --rm php:7.2-alpine -r "echo password_hash('$PASSWORD', PASSWORD_BCRYPT);"`

if [ "${DATABASE_HOST}" == "restodb" ] || [ "${DATABASE_HOST}" == "host.docker.internal" ]; then
    DATABASE_HOST_SEEN_FROM_DOCKERHOST=localhost
else
    DATABASE_HOST_SEEN_FROM_DOCKERHOST=${DATABASE_HOST}
fi

if [ "${ID}" != "" ]; then
PGPASSWORD=${DATABASE_USER_PASSWORD} psql -d ${DATABASE_NAME} -U ${DATABASE_USER_NAME} -h ${DATABASE_HOST_SEEN_FROM_DOCKERHOST} -p ${DATABASE_EXPOSED_PORT} > /dev/null 2> errors.log << EOF
INSERT INTO ${DATABASE_COMMON_SCHEMA}.user (id,email,groups,firstname,password,activated,registrationdate) VALUES (${ID}, '${USERNAME}','{${GROUP}}','${USERNAME}','${HASH}', 1, now_utc());
EOF
else
PGPASSWORD=${DATABASE_USER_PASSWORD} psql -d ${DATABASE_NAME} -U ${DATABASE_USER_NAME} -h ${DATABASE_HOST_SEEN_FROM_DOCKERHOST} -p ${DATABASE_EXPOSED_PORT} > /dev/null 2> errors.log << EOF
INSERT INTO ${DATABASE_COMMON_SCHEMA}.user (email,groups,firstname,password,activated,registrationdate) VALUES ('${USERNAME}','{${GROUP}}','${USERNAME}','${HASH}', 1, now_utc());
EOF
fi
echo -e "[INFO] User ${GREEN}${USERNAME}${NC} created"
