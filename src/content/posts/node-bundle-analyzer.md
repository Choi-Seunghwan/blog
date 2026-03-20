---
image: '/images/posts/node-bundle-analyzer/6.png'
title: 'node 프로젝트 패키지 최적화 (bundle analyzer)'
pubDate: 2023-04-28
author: '승환'
tags: ['개발']
---

나는 재직 중인 팀에서 `NestJs` 기반의 신규 백엔드 서버를 구축하였다. 기존 레거시 `node`, `express` 기반의 프로젝트는 5~6년 전에 작업된 내용이 많아 이전 기능을 참조하면서 신규 백엔드 서버에 기능을 옮겨 올 때에는 여러 고려해야 할 점이 있었다. 특히 구버전 패키지와 관련된 것들이 그러하다.

예를 들어, 레거시 로직에 사용된 오픈소스 패키지가 잘 관리 되고 있는지, 성능, 보안 상에 이슈는 없는지, 이슈가 있다면 대체할 패키지가 있는지 등 이다. 

---

## 문제

- Google 앱스토어에 유저의 구독 결제 여부를 파악하기 위해 사용되던 기존 코드가 있다.
- 이 기능은 [googleApis 패키지](https://www.npmjs.com/package/googleapis) 기반으로 돌아간다.
- 신규 서버에서 [googleApis 패키지](https://www.npmjs.com/package/googleapis)를 설치하니 단번에 IDE 상에서도 부하가 생기고, 프로젝트가 `Hot Reload` 될 때에도 20여초 가량의 추가 시간이 소요 되었다 (Node 메모리 사용량 증가 )

![Untitled](/images/posts/node-bundle-analyzer/2.png)

![Untitled](/images/posts/node-bundle-analyzer/1.png)

빌드 시에 `node —trace-gc` 로 찍어본 메모리 사용량이다. (왼쪽이 패키지 설치 전, 오른쪽이 설치 후)

![Untitled (2).png](/images/posts/node-bundle-analyzer/3.png)

![Untitled (3).png](/images/posts/node-bundle-analyzer/4.png)

서버 동작 중 메모리 사용량도 체크해 보았다. (왼쪽이 패키지 설치 전, 오른쪽이 설치 후)

2배 가량의 메모리 `RSS` (Resident Set Size) 사용량이 증가하였다. ☹️

![스크린샷 2023-04-27 오후 7.58.05 (1) (1).png](/images/posts/node-bundle-analyzer/6.png)

`webpack bundle analyzer` 로 확인해 보았을 때, 최대 번들 크기 `32.83MB` 중의 `20.48MB` 가 `googleapis` 와 연관된 것으로 확인 되었다… 😮

도대체 이 패키지는 뭐하는 놈인고…? 하고 npm에서 [googleApis 패키지](https://www.npmjs.com/package/googleapis) 정보를 확인해 보니, *Unpacked Size*가 `127MB` 나 되었다.

> NPM 패키지들은 NPM 레지스트리에 gzip 압축 형식으로 저장 되어 있다.
npm install 시에 NPM 레지스트리에 압축된 패키지 파일을 다운로드 받으며, *unpacked size* 는 install 시에 압축 해제 된 크기를 뜻한다.
물론, 패키지에 종속된 다른 패키지들도 설치되기 때문에 unpacked size와 더불어 연관 패키지들도 고려해야 한다.
> 

일단, 성능 저하의 원인은 이 패키지 때문이 유력하니, 그럼 이제 해결 방법을 알아보아야 할 차례다.

모듈 번들러는 `javascript` 코드 상에 `import`, `require` 키워드로 참조하는 의존 관계에 있는 패키지들을 함께 번들링 하게 된다.

예를 들어, `import { S3 } from 'aws-sdk';` 와 같이 `aws-sdk` 모듈에 `{ S3 }` 만 export 하여 사용하게 되면, 번들러는 `S3` 와 연관된 코드들을 참조 해가며 번들링 하게 된다.

허나 이 경우에도 번들 크기의 완전한 최적화가 이루어 질 지는 확실하지 않다.

NPM에서는 `@aws-sdk/client-s3`, `@nestjs/jwt`, `@nestjs/core` … 와 같이 namespaced 패키지들을 제공하는데, 특정 회사나 조직에 속한 패키지를 분리하여 관리하거나, 패키지 이름 충돌을 방지하는 데 사용된다.

이번 경우엔 패키지 사이즈를 최적화 하는 데 사용할 수 있겠다.

나와 같은 이슈를 겪은 사람이 또 있었는 지, github Issue 에도 비슷한 내용이 올라와 있다.

[https://github.com/googleapis/google-api-nodejs-client/issues/2187](https://github.com/googleapis/google-api-nodejs-client/issues/2187)

[TypeScript typings cause very high memory usage in tsc · Issue #2187 · googleapis/google-api-nodejs-client](https://github.com/googleapis/google-api-nodejs-client/issues/2187#issuecomment-810414866)

위 답변에 따르면, 2021년 3월부터 googleApi 패키지의 개별 모듈들을 제공하기 시작했다.

---

## 해결

googleapi 모듈을 사용하는 것 대신, 기능에 필요한,

[@googleapis/androidpublisher](https://www.npmjs.com/package/@googleapis/androidpublisher) , [google-auth-library](https://www.npmjs.com/package/google-auth-library) 를 사용하였다.

![패키지 크기 차이.png](/images/posts/node-bundle-analyzer/7.png)

`import cost` 로 보아도 `7.8M` , `433k`, `545k` 로 패키지들의 사이즈가 확연히 차이난다.

![Untitled (4).png](/images/posts/node-bundle-analyzer/5.png)

번들 사이즈 또한 `32.83MB` → `12.5MB` 로 60% 이상 확 줄어들었다.

---

## 결론

개발 하는 동안에는 기능 개발에만 몰두하여 특정 패키지가 프로젝트에 얼마나 파급 효과를 가져올 지에 대해선 놓치기 쉽다.

규모가 큰 팀에서는 패키지 추가에 있어 더욱 방어적으로 접근 하겠지만, 규모가 작은 스타트업에서는 프로젝트 관리 규칙이 없는 경우가 많으므로 개발자 스스로가 더욱 신경써야 한다.
