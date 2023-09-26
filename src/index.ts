import { Environment, EnvironmentError, required, string } from '@herp-inc/environmen-ts';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import * as E from 'fp-ts/Either';
import * as RE from 'fp-ts/ReaderEither';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

// Octokit の promise function のエラーは基本的には RequestError になるが、そうでないエラーを返してきたときには UnknownError で wrap する
class UnknownError {
    message: string = '未知のエラーが発生しました';
    constructor(public reason: unknown) {}
}

// pre-release のチェックを外そうとしたが、既に外れていたパターン
class NotPreRelease {
    message: string;
    constructor({ owner, repo, tag }: { owner: string; repo: string; tag: string }) {
        this.message = `${owner}/${repo} の release:${tag} は pre-release ではありません`;
    }
}

const configD = pipe(
    RE.Do,
    RE.bind('token', () => required('GITHUB_TOKEN', string(), { sensitive: true })),
    RE.bind('owner', () => required('GITHUB_OWNER', string())),
    RE.bind('repo', () => required('GITHUB_REPO', string())),
    RE.bind('tag', () => required('GITHUB_TAG', string())),
);

// main TaskEither<EnvironmentError | NotPreRelease | RequestError | UnknownError,略>
const main = pipe(
    TE.Do,
    TE.bind('env', () => TE.of(new Environment(process.env))),
    TE.bind('config', ({ env }) => TE.fromEither(configD(env))),
    TE.bind('client', ({ config: { token } }) =>
        TE.of(
            new Octokit({
                auth: token,
            }),
        ),
    ),
    TE.bindW('targetRelease', ({ client, config: { owner, repo, tag } }) =>
        TE.tryCatch(
            async () => client.repos.getReleaseByTag({ owner, repo, tag }),
            reason => (reason instanceof RequestError ? reason : new UnknownError(reason)),
        ),
    ),
    TE.chainFirstW(({ config, targetRelease }) =>
        targetRelease.data.prerelease ? TE.of(null) : TE.throwError(new NotPreRelease({ ...config })),
    ),
    TE.bindW(
        '_result',
        ({
            config: { owner, repo },
            client,
            targetRelease: {
                data: { id },
            },
        }) =>
            TE.tryCatch(
                async () =>
                    client.repos.updateRelease({ owner, repo, release_id: id, prerelease: false, make_latest: 'true' }),
                reason => (reason instanceof RequestError ? reason : new UnknownError(reason)),
            ),
    ),
);

main().then(result => {
    pipe(
        result,
        E.fold(
            e => {
                // switch(e.constructor){} で書くと型の補完が効かないので if を並べる

                if (e instanceof NotPreRelease) {
                    console.warn(e.message);
                    // 正常系で終了する
                    return;
                }
                if (e instanceof RequestError) {
                    // Octokit で GitHub にrequest を投げて何らかのエラーレスポンスが帰ってきたパターン
                    // うっかり GITHUB_TOKEN を吐かないように、 console.error(e) はやめておく
                    console.error(e.message, { data: e.response?.data, status: e.status });
                    process.exit(1);
                }
                if (e instanceof EnvironmentError) {
                    // 必要な環境変数が未設定
                    console.error(e.message);
                    process.exit(1);
                }
                if (e instanceof UnknownError) {
                    console.error(e.message, { reason: e.reason });
                    process.exit(1);
                }
            },
            () => {
                console.log('finished');
            },
        ),
    );
});
