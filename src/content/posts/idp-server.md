---
image: '/images/posts/idp-server/1.png'
title: 'IdP(Identity Provider) 서버 개발 : 설계 & 기술 지식 정리'
pubDate: 2026-02-20
author: 'chuz'
tags: ['개발']
---

사내 서비스가 여러 개로 늘어나거나, 사이드 프로젝트/신규 서비스가 생길 때마다, 로그인을 어떻게 붙일지가 고민거리였다.

서비스마다 회원가입, 로그인, 토큰 검증을 제각각 구현하면 초기에는 빠르게 시작할 수 있지만, 서비스가 늘어날수록 보안, 운영, 개발 생산성 면에서 비용이 커지게 된다.

그래서 이번에는 SSO(Single Sign On)를 위한 IdP(Identity Provider) 를 직접 만들어 보며, 실무에서 자주 쓰이는 인증 표준인 OAuth2 / OIDC 를 적용해 개발해 보았다.

IdP(Identity Provider)는 **로그인을 책임지는 중앙 인증 서버**이다.

사용자가 IdP에서 한 번 로그인하면, 각 서비스는 IdP가 발급한 토큰을 검증하는 방식으로 인증을 처리한다.

서비스마다 로그인 로직을 중복 구현하지 않아도 되고, 비밀번호/토큰/보안 정책을 한 곳에서 일관되게 운영할 수 있다.

이 문서에서는 IdP 서버 프로젝트를 진행하면서 설계상 중요하게 생각했던 포인트들과 기술 내용들을 정리해 보았다.

![image1.png](/images/posts/idp-server/1.png)

IdP 로그인 페이지. 로그인 / 회원가입 + 소셜 로그인

![image2.png](/images/posts/idp-server/2.png)

SSO 를 붙인 샘플 클라이언트 화면

## 기술 스택

- Backend : FastAPI
- Auth : OAuth2, OpenId Connect(OIDC), JWT(RS256), PKCE
- DB: PostgreSQL (SQLAlchemy)
- Cache: Redis (OAuth state, code)

## DDD + 클린 아키텍처

NestJS 나 Spring 같은 모던 프레임워크에는 Controller → Service → Repository 같은 전형적인 레이어드 아키텍처를 권장하고, 도와주는 장치가 많다. 반면 FastAPI 는 이런 구조를 프레임워크에서 강제하지 않고, 라우터에서 DB 조회, 응답까지 다 처리해도 동작은 잘 된다.

문제는, 실무에서 여러 명이 함께 코드를 읽고 유지보수 해야 할 때이다. 프로젝트가 일반적인 실무에서 통용되는 구조 외에 독자적인 구조로 작업되어 있다면, 개발자는 ‘비즈니스 로직이 어디 있는 지’ ’DB 접근이 어디에서 일어나는 지’ ‘어떤 레이어가 책임을 갖는 지’ 부터 다시 파악해야 한다.

개발자는 지금 분석중인 프로젝트가, 여타 개발 실무에서 통용되는 그 구조로 되어 있을 것이라고 예상 했을 것이다. 팀 프로젝트의 구조는 예측 가능한 구조가 더 중요하다. 

물론 굉장히 잘 짠 구조가 탄생할 수도 있겠지만, 나는 개인적으로 팀에서 협업하는 프로젝트는 너무 유니크한 구조가 아니어야 한다고 생각하는 편이다. (가독성, 개발자 수급, 검증된 설계 / 디자인 패턴 등의 이유로…)

예를 들어, 아래와 같이 레이어 분리가 잘 되어 있지 않은 코드는 API 에서 DB 를 바로 건드리고, ORM 모델을 그대로 반환하는 형태가 된다.

```python
@router.get("/users/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
	result = await db.execute(select(User).where(User.id == user_id))
	user = result.scalar_one_or_none()
	return user
```

이 코드는 동작은 하겠지만, API와 DB가 강하게 결합된다.

DB 스키마 변화가 곧 API 응답 형상 변화로 이어질 수 있고,

User 엔티티에 hashed_password 같은 민감 필드가 포함되어 있다면, 실수로 응답에 노출될 위험도 생긴다.

```python
class User(Base):
	email: Mapped[str]
	hashed_password: Mapped[str | None] #민감 정보
```

이 문제를 줄이는 가장 기본적인 방법이 `Model(DB 엔티티)`과 `DTO(API 스펙)`의 분리다.

```python
class UserDto(BaseModel):
	email: EmailStr
	username: Optional[str] = None
	# hashed_password 는 제외함	
```

DTO 를 두면 민감 필드가 응답에 섞이는 사고를 구조적으로 막을 수 있고, DB 구조 변경이 API 스펙에 미치는 영향도 직접적이지 않게 제어할 수 있게 된다. (필요한 것만 DTO 로 매핑)

나는 이 프로젝트를 DDD (Domain-Driven Design) 스타일로 도메인을 분리 했다. IdP 서버의 관심사는 크게 다음 도메인으로 구분됐다.

- `user`: 사용자/계정
- `auth`: 인증, 토큰(Access/Refresh)
- `social`: 소셜 계정 연동
- `SSO`: OAuth2 / OIDC 엔드포인트 (Authorize, Token, UserInfo, JWKS)

각 도메인 내부는 다시 레이어로 분리 했다.

- API(라우터): HTTP 요청
- Service: 비즈니스 로직
- Persistence: 데이터
- Model/Dto: 도메인 엔티티와 레이어간 데이터 전송 스펙

그리고 클린 아키텍처의 핵심인 의존성 규칙(의존성 방향을 한쪽으로 통제)를 지키려고 했다.

외부(인프라)가 안쪽(도메인)에 의존하도록 만들고, Service 가 DB 구현체를 직접 알지 못하게 했다.

`persistence.py` 에 추상 Repository 인터페이스를 정의하고, [`di.py`](http://di.py) 에서 FastAPI 의 `Depends` 로 구현체를 주입했다.

```python
# persistence.py
# 추상 인터페이스 정의
class UserRepository(ABC):
	@abstractmethod
	async def find_by_id(self, user_id: str) -> Optional[User]: ...
	

# service.py
# 추상에만 의존 (구현체가 뭔지 모름)
class UserService:
	def __init__(self, user_repository: UserRepository):
		self.user_repository = user_repository

# di.py
# 실제 구현체 연결 Dependency Injection
def get_user_service(
	user_repository: UserRepository = Depends(get_user_repository)
	) -> UserService:
		return UserService(user_repository)
```

이렇게 하면 Service 는 저장소가 PostgreSQL 인지, 다른 DB 인지, 혹은 인메모리인지 모른 채 동일하게 동작한다. 덕분에 테스트에서는 DB 없이도 Mock Repository 주입해서, 비즈니스 로직만 검증할 수 있고, 추후 다른 DB 로 변경 하더라도 Service 로직의 변경 폭을 줄일 수 있게 된다.

## 비밀번호 보안

IdP는 여러 서비스의 인증을 중앙에서 책임지는 시스템이다. 그만큼 비밀번호를 어떻게 다루는지도 중요하다.

DB 가 유출 되었을 때, 평문 비밀번호가 그대로 노출되면 보안 위험이 되게 된다. 따라서 비밀번호는 원칙적으로 복원 불가능한 형태(해시)로만 저장해야 한다.

### 해싱, 암호화, 서명 차이

|  | 해싱 | 암호화 | 서명 |
| --- | --- | --- | --- |
| 방향 | 단방향 (복원 불가) | 양방향 (복호화 가능) | 서명 검증 |
| 목적 | 값이 맞는 지 비교 | 데이터 숨기기 | 누가 만들었는지 / 변조 여부 확인 |
| 예시 | bcrypt, Argon2 | AES | RS256 |

비밀번호는 서버도 원문을 알 필요가 없고 (알아서도 안되고), 로그인 시에 사용자가 입력한 값이 맞는 지만 검증하면 된다. (로그인 시 비밀번호를 해싱하여 비교)

### bcrypt 사용

MD5나 SHA-256 같은 범용 해시는 빠르게 동작하도록 설계 되었다. 데이터 무결성 검증 관점에서는 빠를수록 좋다.

하지만 비밀번호 해시에서는 빠른 것이 오히려 문제가 된다. 해커가 해시 값을 확보하면, 빠른 해시 알고리즘은 브루트포스, 레인보우 테이블 공격에 매우 취약해진다.

bcrypt는 의도적으로 느리게 설계된 비밀번호 해싱 함수이다. 속도를 늦추는 만큼 공격 비용이 증가하고, `cost factor`를 조절하여 하드웨어 성능이 빨라져도 방어 강도를 올릴 수 있게 된다.

bcrypt 해시 문자열은 보통 이러한 형태다.

`$2b$12$LQv3c1yqBwEabcdefghij.xyzHashedResultHere`  
(cost)       (salt)                                (해시)

- $2b$: 알고리즘 버전
- 12: cost factor
- salt + 해시 결과

salt는 같은 비밀번호라도 사용자마다 전혀 다른 해시가 나오게 만든다. 덕분에 공격자가 미리 계산해 둔 레인보우 테이블을 방지할 수 있게 된다.

### bcrypt의 72바이트 제한

bcrypt는 입력을 내부적으로 72바이트까지만 처리한다. 즉 72바이트 이후는 잘려서, 앞 72바이트가 같으면 다른 비밀번호도 동일하게 취급될 수 있다는 함정이 생긴다.

이 프로젝트에서는 이를 피하려고, 비밀번호를 bcrypt 암호화 하기 전에, SHA-256 으로 사전 해싱해서, 항상 고정 길이 바이트 (32바이트)로 만든 뒤 bcrypt  로 암호화 했다.

### 원본 저장하지 않기

IdP 서버에서 다루는 비밀 값은 비밀번호만이 아니다. Refresh Token 같은 인증 수단도 결국 탈취되면 인증이 가능한 비밀번호와 비슷한 성격을 갖는다.

그래서 이 프로젝트에서는 원본 비밀번호, 원본 토큰을 DB에 저장하지 않도록 설계 했다.

아래는 예시다. DB에는 해시만 저장하고, 원본은 클라이언트에게만 전달한다. DB 가 유출되어도 원본을 복원할 수 없다.

```python
# 비밀번호 저장
def hash_password(password: str) -> str:
    sha256_hash = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(sha256_hash)

# Refresh Token 저장
def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

```

## JWT와 RS256

비밀번호 보안이 로그인 시점의 보안이라면, JWT는 로그인 이후 모든 요청을 책임지는 보안이다.

IdP는 사용자 인증이 끝난 후, 매 요청마다 DB 조회를 하지 않고도 사용자를 식별하고 권한을 판별해야 한다. 이 때 토큰 기반 인증이 필요하고, 그 대표가 JWT이다.

JWT는 변조를 검출할 수 있는 서명된 데이터이다. IdP 서버(혹은 서비스)가 JWT를 신뢰할 수 있는 이유는 토큰에 서명이 있기 때문이다.

### JWT 구조. Header, Payload, Signature

JWT는 `.` 으로 구분되는 3개의 파트로 구성된다.

```python
xxxxxx.yyyyyy.zzzzzz
Header.Payload.Signature
```

- Header: 서명에 적용된 알고리즘
- Payload: 사용자 식별자, 만료시간 등 데이터
- Signature: Header.Payload 를 기반으로 만든 서명값 (위변조 방지)

여기서 중요한 점은 Payload가 암호화가 아니라 Base64URL 인코딩이라는 것이다. 즉 누구나 디코딩해서 내용을 볼 수 있으므로, JWT Payload에 는 민감한 정보나 비밀값을 넣으면 안된다.

JWT는 숨기는 토큰이 아니라, 변조를 막는 토큰에 가깝다. (공격자가 Payload의 데이터를 변조하면 Signature 가 일치하지 않음)

### RS256 선택 이유. HS256 / RS256

JWT 서명 방식은 크게 HS256(대칭키)와 RS256(비대칭키)로 나뉜다.

|  | HS256 (대칭키) | RS256 (비대칭키) |
| --- | --- | --- |
| 키 구성 | Secret | Private Key, Public Key |
| 서명 | Secret 으로 서명 | Private Key 로 서명 |
| 검증 | Secret 으로 검증 | Public Key 로 검증 |
| MSA | 모든 서비스에서 Secret 공유 필요 | 서비스는 Public Key만 보유 |
| 유출 위험 | 한 서비스 유출 → 전체 시스템 Secret 유출 | Public Key 만 유출 (서명 위조 불가) |

HS256은 토큰을 검증할 때 서비스가 Secret을 알아야 한다.

문제는 서비스 A, 서비스 B, 서비스 C 모두 동일한 Secret 을 갖고 있어야 하므로, 어느 한 서비스의 Secret이 유출되면 전체 시스템이 위험해지는 구조가 된다.

RS256은 IdP만 Private Key를 가진다.

Idp는 Private Key 로 서명을 발급해 주고, 각 서비스는 Public Key로 검증을 수행하면 된다.

서비스 단에는 Private Key가 없어, 서비스가 해킹당해도 토큰을 위조할 수 없다.

### JWKS (JSON Web Key Set) 엔드포인트

IdP에서만 서명(Private Key)을 하고, 각 서비스는 검증만 하는 구조에서는, 각 서비스가 JWT 를 검증하기 위한 IdP의 공개키 (Public Key)를 알아야 한다.

이 공개키를 서비스마다 파일로 복사해서 배포하면, 처음엔 단순해 보이지만 운영 관점에서 점점 불편해진다.

파일 배포 방식의 문제는 키 교체가 어렵다는 점이다. 실제로 운영하다 보면 키는 영원히 고정될 수 없다.

키 유출 의심 또는 보안 이슈에 대응하거나, 보안 정책에다 따라 키를 정기 교체(Rotate) 해야 하기 때문이다.

이때 공개키를 서비스 배포에 고정 방식으로 박아두면, 키가 바뀌는 순간 모든 서비스를 동시에 배포해야 한다. 서비스가 많아질수록 이 과정은 점점 위험도가 커진다.

어떤 서비스는 새 키를 반영했고, 어떤 서비스는 아직 이전 키만 가지고 있다면, 같은 토큰이 어디선 되고 어디서는 안 되는 이상한 상황이 발생할 수 있다.

즉, 공개키를 파일로 배포하는 방식은 서비스 규모가 커질수록 운영이 힘들어진다.

그래서 표준(OIDC) 에서는 공개키를 HTTP 엔드포인트로 제공하는 방식을 권장한다.

이 엔드포인트가 바로 JWKS(Json Web Key Set) 이다.

IdP는 `/oauth2/jwks` 같은 엔드포인트로 공개키 목록을 제공한다.

서비스는 주기적으로 JWKS를 가져와 캐싱하고, JWT를 검증한다.

아래는 RS256 공개키 1개를 담은 예시이다.

```json
{
  "keys": [
    {
      "kty": "RSA",        // Key Type: RSA 키라는 의미
      "kid": "default",    // Key ID: 키 식별자 (키 롤오버 시 어떤 키로 검증할 지 구분)
      "alg": "RS256",      // Algorithm: 서명 알고리즘
      "n": "....",         // Modulus: RSA 공개키의 n 값 (Base64URL 인코딩)
      "e": "AQAB"          // Exponent: RSA 공개키의 e 값 (보통 65537 → Base64URL로 AQAB)
    }
  ]
}
```

서비스는 `n`, `e` 를 이용해 RSA 공개키를 구성하고 JWT 서명을 검증한다. JWT  헤더에 `kid` 가 있으면 그 `kid` 에 해당하는 키를 JWKS 에서 찾아 검증한다

따라서 JWKS 는 단순히 키 제공이 아니라, 키 교체(롤오버)를 가능하게 하는 표준 장치가 된다.

> OIDC 표준이란?
> OAuth2는 인증(Authentication) 보다, 인가 (Authorization)에 초점이 맞춰진 표준이다.
> 즉, 사용자가 누구인지를 표준화 하기 보다는, 어떤 리소스에 접근 권한을 줄지가 중심이다.
> OIDC(OpenID Connect)는 OAuth2 위에 인증 레이어를 얹어서, 아래와 같은 것들을 표준으로 정리 해준다.
>
> - ID Token (로그인 결과로 사용자 식별을 표준화)
> - UserInfo (표준 사용자 정보 API)
> - JWKS (토큰 서명 검증을 위한 공개키 제공 방식)

## Access Token / Refresh Token

RS256 + JWKS 로 각 서비스단에서 토큰 검증에 대해 알아 보았다면, 이제는 한 단계 더 들어가 토큰이 탈취 되었을 때 피해를 어떻게 줄일 것인지를 고민해 봐야 한다.

실무에서 토큰 기반 인증을 설계할 때는 Access , Refresh 토큰 분리가 사실상 표준적인 방식이다. 이유는 간단하다. 토큰이 노출되는 빈도가 다르기 때문이다.

Access Token은 모든 인증이 필요한 API 요청에 포함된다. (노출 빈도가 높음)

Refresh Token은 토큰 재발급 요청에만 포함된다. (노출 빈도가 낮음)

즉, 자주 노출되는 토큰은 짧게, 덜 노출되는 토큰은 길게 가져가야 전체 위험도를 조절할 수 있다.

### Stateless, Stateful 트레이드오프

여기서 중요한 트레이드오프가 생긴다.

Access Token은 토큰 자체(서명 / 만료 / 클레임)만으로 검증하는 stateless 방식을 쓰면 빠르고 확장성이 좋다. 다만 서버가 별도로 토큰 정보를 기억하고 있지 않기에, 로그아웃이나 탈취 대응처럼 즉시 폐기(revoke) 를 하려면 블랙리스트(jti) 같은 추가 상태 관리가 필요해진다.

Refresh Token 은 세션을 통제하는 목적이 강해서, 서버가 유효성을 판단할 수 있는 정보를 어딘가에 저장해 두는 (stateful) 방식으로 구현하는 경우가 많다. (물론 Refresh Token도 stateless 하게 설계할 수는 있지만, 그 경우에도 탈취 대응을 위해 결국 별도의 상태 전략이 필요해진다.)

상태를 두면 로그아웃 / 탈취 의심 시 즉시 폐기가 가능해지지만, 그만큼 저장소 조회 / 관리 비용이 생긴다.

그래서 실무에서는 보통 Access Token은 stateless 로 (서명 검증) 빠르게,

Refresh Token은 stateful (저장소 기반 통제)로 안전하게 관리한다.

### IdP 프로젝트에서 구현

Access Token은 API 요청단에서 인가(Authorization) 역할을 하기에 검증 비용이 작아야 한다.

이 프로젝트에서는 RS256 + JWKS 기반으로, 각 서비스가 Public Key 만으로 독립적으로 검증할 수 있게 했다.  

- 서명 검증
- 만료 exp
- 토큰 타입 type=access 확인

Refresh Token 은 DB에 원본 토큰 대신 해시만 저장하는 방식으로 구현했다.

이렇게 하면 DB가 유출되어도 원본 토큰을 바로 사용할 수 없고, 위험 감지 시 저장소에서 즉시 폐기 할 수 있다.

또한 Idp 서비스 특성상 성능 최적화보다 탈취 대응 가능성이 더 중요하다고 판단해, Refresh Token은 상태를 저장하는 방식(stateful) 하게 구현 하였다.

## Token Rotation & Reuse Detection

Refresh Token을 stateful 하게 관리하는 이유는 단순히 ‘revoke가 가능해서’만이 아니다. 탈취를 감지하고 피해를 최소화하기 위해서다. 그 핵심 패턴이 Token Rotation과 Reuse Detection 이다.

### Token Rotation

Token Rotation은 Refresh Token으로 새 Access Token을 발급 받을 때,  Refresh Token 도 함께 새로 발급하고 기존 Refresh Token은 즉시 폐기하는 방식이다.

1. Client: `refresh_token_A` 로 재발급 요청
2. Server: `access_token_new` + `refresh_token_B` 발급
3. Server: `refresh_token_A` 폐기 (revoke)

이렇게 하면 Refresh Token이 사실상 일회용에 가까워져서, 탈취된 토큰의 유효 기간을 짧게 만들 수 있다.

또한 Token Rotation은 Sliding Session을 가능하게 한다. 예를 들어 Refresh Token 수명이 7일이라고 할 때, 고정 만료 방식은 발급 후 7일 뒤 무조건 만료 되므로 클라이언트는 다시 로그인 해야 하는 불편함이 생긴다.

Token Rotation 방식에서는 `/refresh`를 사용할 때마다 새 토큰으로 교체되기 때문에, 활동이 있는 동안 세션을 유지할 수 있다. 사용자 입장에서는 로그인이 자주 풀리는 불편이 줄고, 서버 입장에서는 오래된 토큰을 계속 들고 다니는 구조를 피할 수 있다.

토큰이 교체되면 이전 Refresh Token은 폐기 된다. 그런데 폐기된 Refresh Token이 다시 사용된다면?

정상 사용자라면 이미 새 토큰을 받고, 이전 토큰을 다시 쓸 일이 없다. 따라서 **폐기된 토큰의** 재사용은 탈취/복제 가능성이 매우 높다. 서버는 이 상황을 단순 ‘인증 실패’가 아니라 보안 이슈로 취급할 수 있다.

### Reuse Detection

공격자가 Refresh Token을 탈취한 상태에서, 정상 사용자가 먼저 `/refresh` 를 호출한 경우엔, 공격자가 탈취한 Refresh Token이 폐기 되므로 공격자는 더 이상 재발급을 못 받는 상태가 된다.

문제는 공격자가 탈취한 토큰을 먼저 사용하는 경우다.

1. 공격자: 탈취한 `refresh_token_A` 로 재발급 → `refresh_token_B` 획득
2. 정상 사용자: `refresh_token_A` 로 재발급 시도 → 이미 폐기된 토큰

이 때 이미 폐기된 Refresh Token이 다시 사용 되었다는 건, 정상 흐름에서는 거의 발생하지 않기 때문에, 탈취/복제 가능성이 매우 높다는 강한 신호가 된다.

### 세션 단위 폐기 `family_id`

이 프로젝트에서는 `family_id` 로 Refresh Token 체인을 묶고, Reuse가 감지되면 해당 세션(family) 전체를 폐기하는 전략으로 설계했다.

```python
class RefreshToken(Base):
    family_id: Mapped[str]                 # 동일 로그인 세션(체인) 식별자
    rotated_from: Mapped[str | None]       # 이전 토큰 ID (체인 추적)
    revoked_at: Mapped[datetime | None]    # 폐기 시점 (폐기 여부 판단)
```

## OAuth2 Authorization Code Flow (SSO)

지금까지 발급된 토큰을 어떻게 안전하게 운영할 것인가를 다뤘다면, 이제는 토큰을 어떤 절차로 발급 받는가.

즉, SSO의 핵심인 OAuth2 Authorization Code Flow 를 정리한다.

SSO 시나리오를 생각해보자. 사용자가 서비스 A에서 IdP로 로그인 버튼(SSO)을 누르면, 

1. 서비스 A → IdP 로그인 페이지로 리다이렉트
2. 사용자가 IdP에서 로그인
3. IdP → 서비스 A 로 토큰 전달

이러한 프로세스를 가진다. 문제는 IdP에서 서비스 A 로 토큰을 전달할 때이다.

가장 단순한 방법으로 토큰을 URL에 직접 담을 수 있다.

```python
https://service-a.com/callback?access_token=eyJhbG...&refresh_token=eyJhbG...
```

하지만 이 방법은 보안 위험이 크다

- 브라우저 히스토리에 토큰이 남음
- Referer 헤더로 다른 사이트에 토큰이 노출될 수 있음
- 프록시 /  서버 로그에 URL 이 포함되면 토큰도 함께 기록된다
- UI 스크린샷 같은 것으로도 노출될 수 있다

### Authorization Code 방식

OAuth2 표준에서는 토큰을 곧바로 브라우저에 주지 않고, 일회용 `code` 를 먼저 발급한 뒤, 이 code를 클라이언트 서버가 IdP의 `/token` API 에 제출하여 토큰으로 교환하는 방식을 사용한다.

즉, 브라우저에는 토큰이 아니라 짧은 수명의 code만 노출되고, 실제 토큰은 발급 서버간의 통신으로 수행된다.

### Authorization Code Flow

등장 주체는 셋이다

- 사용자 브라우저 (User Agent)
- 서비스 A (클라이언트, OAuth Client)
- IdP (Authorization Server)

진행은 다음 순서와 같다.

1. 서비스 A 가 사용자를 IdP의 `/authorize` 로 리다이렉트
2. 사용자가 IdP에서 로그인. IdP가 로그인 확인
3. IdP가 authorization code 발급 후 `redirect_uri` 로 리다이렉트
(`redirect_uri?code=…&...`)
4. 서비스 A 서버가 code를 받으면, IdP의 `/token` 으로 요청하여 토큰으로 교환
5. IdP가 code 를 검증한 후 Access/Refresh Token 발급

여기서 핵심은, code 는 브라우저에 노출되지만, 토큰은 브라우저에 노출되지 않는다는 점이다.

### `/authorize` 리다이렉트 검증 + code 발급

`/authorize` 는 보안적으로 가장 중요한 검증이 모여 있다.

- `client_id` 가 유효한 지 (등록된 클라이언트인지)
- `redirect_uri` 가 사전에 등록된 값과 일치 하는지
- `response_type=code` 인지
- `scope` 가 허용 범위인지
- `state` 를 통한 CSRF 방어

특히 redirect_uri 검증이 중요하다. 공격자가 자신의 도메인으로 리다이렉트를 유도해 code 를 가로채는 공격이 가능해지기 때문이다.

### Authorization Code

IdP 는 발급한 code를 검증해야 하므로, code 와 함께 아래의 정보를 저장한다.

- `code` 랜덤 문자열
- `client_id`, `user_id`
- `redirect_uri` 발급 당시 리다이렉트 주소
- `scopes`
- `expires_at` 1분 정도
- `is_used` 사용 여부

### `/token` code → token 교환

서비스 A 서버는 브라우저로부터 받은 code 를 이용해 IdP의 `/token` 에 요청한다. IdP는 code 를 검증한 후, 검증에 성공하면 토큰을 발급하고 code는 즉시 사용 처리한다. 이렇게 하여 code 가 탈취 되었더라도 재사용이 불가능하도록 한다.

Authorization Code Flow는 서버가 있는 웹앱에서는 기본적으로 안전하다.

하지만 SPA / 모바일 앱처럼 client_secret 을 안전하게 보관할 수 없는 환경에서는 code 가 탈취되면 `/token` 교환 자체가 가능해질 수 있다.

## PKCE (Proof Key for Code Exchange)

Authorization Code Flow 는 서버가 있는 웹앱을 기준으로 설계된 플로우다. 이런 환경에서는 `/token` 요청에 `client_secret` 을 함께 보내서, code 교환 요청이 진짜 서비스 A 서버에서 온 것인지를 증명할 수 있다.

문제는 SPA / 모바일 앱처럼 클라이언트 코드가 사용자 디바이스에 배포되는 환경(Public Client)이다.

SPA는 브라우저 개발 도구로 번들 코드를 확인할 수 있고, 모바일 앱도 리버스 엔지니어링으로 내부 문자열을 추출할 수 있다. 즉, `client_secret` 을 안전하게 숨기는 것이 사실상 불가능하다.

이 상태에서 authorization code 가 탈취되면, 공격자가 그 code 를 들고 `/token` 교환을 시도할 수 있다. (서버는 진짜 앱이 보낸 요청이 맞는 지 구분하기 어렵다.)

그래서 OAuth2는 공개 클라이언트 환경에서 Authorization Code Flow를 안전하게 쓰기 위한 장치로 PKCE를 도입했다.

PKCE의 핵심은 이렇다. code 만으로는 토큰을 교환할 수 없게 하고, code를 처음 요청한 클라이언트만 교환에 성공하도록 추가 증명을 붙이는 것이다.

### PKCE 흐름 (S256)

PKCE는 code 를 받기 전에, 클라이언트가 미리 만든 비밀 문자열을 이용해 code를 교환할 때 추가 증명을 요구한다.

1. 클라이언트가 랜덤 문자열 `code_verifier`를 생성한다 (비밀값, 로컬에만 보관)
2. 클라이언트가 `code_challenge = BASE64URL(SHA256(code_verifier))` 을 만든다. (검증용 해시)
3. `/authorize` 요청 시 `code_challenge` 와 `code_challenge_method=S256`을 전달한다.
4. `/token` 요청 시 `code_verifier` 를 전달한다.
5. IdP는 `BASE64URL(SHA256(code_verifier))`를 다시 계산해, 저장된 `code_challenge`와 일치하는지 검증한다.

즉, 공격자가 code를 탈취하더라도 `code_verifier` 가 없으면 `/token` 교환이 실패한다.

## OpenID Connect (OIDC)

OAuth2는 원래 인가(Authorization) 중심의 표준이라, 사용자 인증 결과를 어떤 형태로 주고 받을지 표준으로 정의하지 않는다.

이를 위해 OAuth2 위에 인증(Authentication) 레이어를 얹은 규격이 OIDC 이다. 

OIDC 는 OAuth2 + ‘인증 표준’이다.

OIDC 가 제공하는 핵심 요소는 아래와 같다

- ID Token : 이 사용자가 누구인지를 표준 클레임으로 담은 JWT
- UserInfo : Access Token 으로 호출하는 표준 사용자 정보 API
- Discovery : 클라이언트가 IdP 설정 (endpoint / JWKS 등)을 찾게 해주는 표준 메타데이터

### ID Token

OIDC 에서는 클라이언트가 `scope` 에 `openid` 를 포함하면 `/token` 응답에 ID Token 이 함께 전달된다.

ID Token 은 API 호출용 토큰이 아니라, 로그인 결과를 전달하는 인증 토큰이다.

- Access Token: API 호출용 (리소스 접근)
- Refresh Token: 토큰 재발급용
- ID Token: 로그인 결과(인증)

```python
{
  "iss": "https://idp.example.com",   // issuer: 발급자 (IdP)
  "sub": "user-123",                  // subject: 사용자 고유 식별자
  "aud": "service-a-client-id",       // audience: 이 토큰을 받을 클라이언트
  "exp": 1700000000,                  // 만료 시간
  "iat": 1699990000,                  // 발급 시간
  "email": "user@example.com",        // (선택) 스코프/정책에 따라 포함
}
```

서비스는 ID Token 의 서명과 클레임 (`iss`/`aud`/`exp` 등)을 검증해 사용자의 로그인 여부를 판단할 수 있다

### UserInfo

OIDC는 `userinfo_endpoint` 를 표준으로 제공한다. 클라이언트는 Access Token 으로 `/userinfo` 를 호출한다. IdP 는 scope 에 맞는 사용자 정보를 반환한다.

```bash
GET /oauth2/userinfo
Authorization: Bearer <access_token>
```

```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Seunghwan",
  "preferred_username": "seunghwan"
  ...
}
```

이 패턴을 사용하면 각 서비스 A/B/C 는 제각각 따로 사용자 정보 API 를 구성하는 게 아니라, 표준에 따른 같은 방식으로 사용자 정보를 얻을 수 있다.

### Discovery

Discovery는 `/.well-known/openid-configuration` 같은 엔드포인트로, IdP의 주요 URL(authorization / token / userinfo / JWKS 등) 을 메타데이터로 제공한다.

```json
{
  "issuer": "https://idp.example.com",
  "authorization_endpoint": "https://idp.example.com/oauth2/authorize",
  "token_endpoint": "https://idp.example.com/oauth2/token",
  "userinfo_endpoint": "https://idp.example.com/oauth2/userinfo",
  "jwks_uri": "https://idp.example.com/oauth2/jwks",
  "response_types_supported": ["code"],
  "scopes_supported": ["openid", "profile", "email"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

## 소셜 로그인 (Google, Kakao, Naver)

이 프로젝트는 외부 Provider 토큰을 직접 사용하는 게 아니라, 외부 인증 결과를 바탕으로 IdP 자체 Access/Refresh Token 을 발급한다.

Google/Kakao/Naver 와 같은 Provider 입장에서 IdP는 OAuth2의 Client 가 된다.

흐름은 아래와 같다.

1. GET `/social/{provider}/login`
    1. Provider 인증 URL 생성
    2. state 생성 후 Redis 저장 (CSRF 방어)
2. Provider 로그인 / 동의 화면
3. GET `/social/{provider}/callback?code=…&state=…`
    - `state` 검증. Redis 조회 후 즉시 삭제 (일회용)
    - `code` 로 Provider access token 교환
    - Provider 사용자 정보 조회 (`provider_user_id`, `email`, `name`)
    - 내부 계정 매핑 (있으면 로그인 / 없으면 자동 가입)
    - IdP 자체 Access/Refresh Token 발급
    - 토큰은 URL 로 직접 넘기지 않고 일회용 교환 코드로 전달

### 계정 매핑 `provider_user_id`

소셜 로그인에서 내부 사용자 매핑은 `provider`, `provider_user_id` 를 기준으로 한다

```python
social_account = await find_by_provider_and_user_id(provider, provider_user_id)

if social_account:
    user = await get_user_by_id(social_account.user_id)
else:
    user = await create_user_from_oauth(user_info)
    social_account = await create_social_account(user.id, provider, user_info)
```

### `state` 검증 (CSRF 방어)

아래는 소셜 로그인에서 CSRF 공격을 당할 수 있는 순서이다.

1. 피해자가 IdP에 이미 로그인된 상태 (세션/쿠키 있음)
2. 공격자가 자신의 Google 계정으로 callback URL 생성
    1. /social/google/callback?code=공격자코드
3. 이 링크를 피해자에게 전송
4. 피해자가 클릭 → 피해자 브라우저에서 callback 실행
    1. 피해자의 세션 쿠키가 함께 전송됨
    2. 공격자의 google이 피해자 계정에 연동됨
5. 공격자는 이제 자신의 google 로 피해자 계정에 접근 가능

이 시나리오로 공격을 당하면 피해자는 이 계정이 자기 계정이라 생각하고 민감 정보를 입력하고 앱 내에서 사용하는 등 피해를 입게 된다.

이 프로젝트에서는 로그인 시작 시 서버가 난수 `state`를 생성해 Redis 에 짧게 저장하고 (TTL), Provider authorize URL 에 `state` 를 포함한다.

콜백에서 전달받은 `state` 로 Redis 를 조회해 우리가 시작한 플로우가 맞는 지 검증한 후 즉시 `state` 를 삭제한다 (일회용)

Redis에 값이 없으면 만료 / 위조된 요청으로 판단해 실패 처리한다.

```python
# 로그인 시작 시
state = secrets.token_urlsafe(32)
await redis.setex(f"oauth_state:{provider}:{state}", 600, data)

# 콜백 시
value = await redis.get(f"oauth_state:{provider}:{state}")
if not value:
    raise BadRequestException("Invalid or expired state")  # CSRF 의심
await redis.delete(f"oauth_state:{provider}:{state}")  # 일회용 삭제

```

## 트랜잭션

트랜잭션은 CS 기본 개념이므로, 여러 DB 작업을 하나의 논리적 단위로 묶는 기능이다.

트랜잭션은 전부 성공하거나, 아니면 전부 실패하는 것을 보장하는 것이다.

예를 들어 신규 사용자 소셜 로그인을 보면, 내부적으로는 여러 테이블에 대한 쓰기 작업이 한 번에 일어난다.

```python

user = await self._create_user_from_oauth(user_info) # User insert
social_account = await self._create_social_account(...) # SocialAccount insert
tokens = await self.auth_service.login_with_user_id(...) # RefreshToken insert 
```

이 중 하나라도 실패하면 전부 취소 되어야 한다.

User만 생성되고 SocialAccount가 없다면 소셜 로그인으로 가입했는데 소셜 연동 정보가 없는 모순 상태가 생기고, 이후 로그인/연동 로직에서 정합성 문제가 발생하게 된다.

### ACID 속성

| 속성 | 설명 |
| --- | --- |
| Atomicity (원자성) | 전부 성공 or 전부 실패 |
| Consistency (일관성) | 트랜잭션 전후로 무결성/제약조건 유지 |
| Isolation (격리성) | 동시 실행 트랜잭션끼리 서로 간섭하지 않음 |
| Durability (지속성) | 커밋된 데이터는 장애가 나도 보존 |

### 트랜잭션 처리

이 프로젝트는 하나의 API 요청을 하나의 트랜잭션으로 관리한다.

FastAPI Dependency로 세션을 주입하고, 요청 처리가 끝날 때 `commit`/`rollback` 을 수행한다.

```python
# database.py
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()  # 요청 성공 : 커밋
        except Exception:
            await session.rollback() # 예외 발생 : 롤백
            raise
```

`Service`/`Repository` 레이어에서는 `commit()`을 직접 호출하지 않고,  `flush()` 를 호출. 각 계층에서는 트랜잭션의 시작과 종료를 신경쓰지 않아도 된다.

- `flush()` 현재 트랜잭션 안에서 SQL을 DB에 실행하지만, 커밋 전이므로 롤백 가능
- `commit()` 트랜잭션 확정 (영구 저장)
- `rollback()` 트랜잭션 취소 (flush 변경 사항 전부 되돌림)

요청 도중 예외가 발생하면, 그 요청 로직에서 했던 DB 변경이 통째로 rollback 이 된다. 따라서 여러 도메인이 협력하는 로직에서도 정합성을 지킬 수 있게 된다.

(주의할 점은, 요청이 길어지면 트랜잭션이 오래 열러 락/경합이 생길 수 있다)

## 마무리

이번 IdP 프로젝트를 통해 인증, 보안 기술 지식을 전반적으로 훑어 보며 많이 학습할 수 있었다.

문서로만 이해하던 개념들을 실제 프로젝트를 구현해 나가면서, 왜 이런 설계가 필요한지, 어떤 위험을 막기 위한 기술인지 등을 더 잘 체감할 수 있었다.