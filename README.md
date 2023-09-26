# un-pre

GitHub の pre-release を latest-release にする docker image

Argo Workflows や Argo CD の post sync hook 等での利用を想定している

## usage

- [Access Token](https://github.com/settings/tokens) を作成する
  - `repo` に ✅

- 環境変数で対象のリリースを指定
  - 例）`pf-siedler/un-pre` の `release-hoge` を pre-release から latest-release にする場合
```
export GITHUB_OWNER=pf-siedler
export GITHUB_REPO=un-pre
export GITHUB_TAG=release-hoge
export GITHUB_TOKEN=##### PASTE YOUR TOKEN HERE #####
```

- docker run する
```
docker run ghcr.io/pf-siedler/un-pre/un-pre:1.0.0
```

## Build

```
docker build .
```
