---
image: '/images/posts/freelancer-shopping-mall/1.png'
title: '첫 프리랜서 경험, 그리고 쇼핑몰 예제 프로젝트 개발'
pubDate: 2025-04-04
author: '승환'
tags: []
---

### 첫 프리랜서 백엔드 개발자 경험

이번에 좋은 기회로 프리랜서 백엔드 개발자로 일할 수 있는 기회를 얻었다.

내내 정규직으로만 근무하다가 프리랜서로는 처음 일 해 보았는데, 다행히 함께 일한 프리랜서 동료분들도 좋은 분들이 많았고, 정규직과 프리랜서가 한 팀으로 일하면서 큰 괴리감 없이 일하는 곳이었기에, 기획, 디자인, PO, PM 등 다른 분들과 일하는 것도 괜찮았다. 함께 일하신 분들 성향이 다들 나이스 해서 더 좋았던 것 같다.

다행히도 첫 프리랜서 경험을 좋은 곳에서 한 것 같다.

아쉽게도 판교 생활을 청산하고 대전에서 자리 잡기 위해 그만두게 되었지만, 대전과 판교를 오가는 출퇴근이 힘든 점을 고려하여 재택근무로 전환 시켜 주는 등 감사한 대우를 많이 받았다. 🙇🏻‍♂️

규모가 있거나 그 조직만의 시스템이 갖춰진 개발팀에서 일하는 것은 항상 좋은 경험이 된다. 조직 프로세스의 장단점이나, 직접 경험해 보지 않았다면 내가 전혀 몰랐을 다양한 요소들을 접하면서 배우는 것들이 많기 때문이다.

완전히 새로운 환경에서 일하게 되는 것은 늘 쉽지만은 않은데, 그럼에도 서서히 그 조직에 적응해 가다보면 얻는 것이 참 많다. 이는 모든 직장인들이 이직 할 때마다 겪는 일이리라.

일하면서 개발했던 서비스는 CCTV 영상보안 플랫폼이었는데, 자영업자 유저가 플랫폼에서 CCTV를 구매하면 앱으로 실시간 CCTV 보안 영상을 볼 수 있는 기능과, 직원들 근태관리 기능을 구독 상품으로 제공하는 서비스였다.

나는 백엔드 개발자로서, MSA 구조로 나뉜 환경에서 커머스 도메인, 구독 도메인, 관리자 도메인 그리고 게시물 관련 도메인 개발을 맡게 되었다.

커머스 도메인의 주문/결제 프로세스는 처음 업무적으로 개발하는 것이여서 걱정과 압박이 좀 많이 있었는데, 출퇴근 대중교통에서도 계속 정보들 찾아보고, 퇴근 후에 집에 와서도 스터디용 코드를 따로 짜보면서 어떻게든 해나갔던 것 같다.

또 나는 개인적으로 생각했을 때 주변인에 대한 운이 상당히 좋은 편이라고 생각하고 있는데, 이번에도 그런 경우였다. 함께 일하는 시니어 프로젝트 관리자분이 내가 처음 프리랜서를 해서 이런저런 부담감이 크다는 것도 많이 고려를 해 주셨고, 고민도 많이 들어주신 덕분에 부담감을 많이 줄일 수 있었다.

여러모로, 주문/결제/구독 실제로 돈이 오고가는 민감한 영역에서 업무를 했던 경험이 지나고보니 나에게 개발자로서 양분이 많이 되었다.

### **쇼핑몰 예제 프로젝트 개발**

![image.png](/images/posts/freelancer-shopping-mall/1.png)

[Shop-Web](https://web.shop.chuz.site/)

이번에 경험했던 것들을 토대로, 간단한 쇼핑몰 사이트를 만들어 보았다. 원래는 단순한 쇼핑몰을 함께 만들어 가는 주제로 강의를 하나 만들어 보려 하였는데, 현재 개발 중인 프로젝트에 할 일이 많기도 하고, 가장이 되면서 이런저런 할 일이 많아지다 보니, 변명을 담아 강의 대신 예제 프로젝트를 Github 에 공개하는 것으로 하기로 했다. (물론 다듬어야 할 부분이 많지만)

 

### 기술

프론트는 React 로 개발 하였다. 전역 state는 Context API 를 사용했고, css는 익숙해서 styled 컴포넌트로 개발하였다.

백엔드는 Nest 프레임워크를 사용하였다. 이제 Node로 서버 개발할 때 Nest 가 아니면 너무 불편한 지경에 이르렀다. Nest 덕분에 Node 진영에서도 Spring 처럼 프로젝트마다 유사한 코드 및 구조, 아키텍처, 패턴으로 개발하게 된 점이 좋다.

그리고 백엔드는 MSA 형태로 구현해 놓았다. 다른 프로젝트를 개발할 때 필요한 도메인을 템플릿처럼 사용하기 위함이다.

백엔드의 각 Service들은 서로 다른 프로젝트로 구분되어 있으므로, 공통 유틸 기능은 패키지 형태로 개발/배포 하였다. 각 서비스에서 필요한 MSA 공통 모듈을 받아 사용하는 방식이다.

인프라는 AWS 를 사용했다. 도메인은 Route53 는 비싸므로… [namecheap](https://www.namecheap.com/) 에서 저렴하게 구매했다.

S3 → CloudFront 를 이용하여 프론트 정적 배포와 이미지 저장소를 구성 하였다.

EC2에 서버 배포를 하였으며, 백엔드는 [https://commerce.shop.chuz.site](https://commerce.shop.chuz.site/) 와 [https://account.shop.chuz.site/](https://account.shop.chuz.site/) 이렇게 두 가지가 있는데, Nginx 포트포워딩을 통해 구성했다.

DB 는 PostgreSQL(Prisma) 을 사용하였다.

백엔드는 [https://letsencrypt.org](https://letsencrypt.org/ko/) 로 TLS 인증서를 발급 받고, Nginx 로 https 구성을 하였고,

프론트는 ACM, CloudFront 로 TLS 인증서를 적용 했다.

그럼 다음 글에서 사이트 기능 설명과, 회원 / 본인인증 / PG 결제 / 인프라 등 전체 시스템에 대해 설명하도록 하겠다.

이 글을 보는 누군가에게, 내가 작업한 것들이 도움이 되었으면 좋겠다.

### URL

frontend web [https://github.com/Choi-Seunghwan/shop-web](https://github.com/Choi-Seunghwan/shop-web)

account-service  [https://github.com/Choi-Seunghwan/shop-account-service](https://github.com/Choi-Seunghwan/shop-account-service)

commerce-service [https://github.com/Choi-Seunghwan/shop-commerce-service](https://github.com/Choi-Seunghwan/shop-commerce-service)

msa-common-packages [https://github.com/Choi-Seunghwan/msa-common-packages](https://github.com/Choi-Seunghwan/msa-common-packages)
