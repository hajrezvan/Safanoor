#!/bin/sh
set -eu
umask 077
printf '%s\n' \
  's3proxy.authorization=aws-v4' \
  's3proxy.endpoint=http://0.0.0.0:9000' \
  "s3proxy.identity=${S3_ACCESS_KEY}" \
  "s3proxy.credential=${S3_SECRET_KEY}" \
  'jclouds.provider=filesystem' \
  'jclouds.filesystem.basedir=/data' \
  > /tmp/s3proxy.properties
exec java -Dorg.slf4j.simpleLogger.defaultLogLevel=warn -jar /opt/s3proxy.jar --properties /tmp/s3proxy.properties
