FROM node:24-alpine
WORKDIR /app
COPY index.mjs ./
ENV PORT=8787 SHARE_DB=/data/links.sqlite
VOLUME /data
EXPOSE 8787
CMD ["node", "index.mjs"]
