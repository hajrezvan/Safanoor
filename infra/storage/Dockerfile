FROM eclipse-temurin:25-jre
ADD --checksum=sha256:cd2e81919e7e1b8d8a23750c9792bb306a2f841a0222a80919b72e989eedd94b https://github.com/gaul/s3proxy/releases/download/s3proxy-4.1.1/s3proxy /opt/s3proxy.jar
COPY start.sh /opt/start.sh
RUN mkdir /data && chown 10001:10001 /data && chmod 755 /opt/start.sh && chmod 444 /opt/s3proxy.jar
USER 10001:10001
EXPOSE 9000
ENTRYPOINT ["/opt/start.sh"]
