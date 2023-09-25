FROM node:18.16.0-alpine3.17

RUN apk add --update --no-cache && apk add --no-cache tini

WORKDIR /workdir

COPY package.json /workdir/
COPY yarn.lock /workdir/
COPY tsconfig.json /workdir/
COPY src/ /workdir/src/

RUN yarn install --frozen-lockfile --ignore-scripts &&\
    yarn build &&\
    yarn install --frozen-lockfile --ignore-scripts --production

COPY ./dest /workdir

RUN rm -rf src/ tsconfig.json

ENTRYPOINT ["node"]
CMD ["dest"]
