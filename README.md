# 사용

## 공통
1. serverless_template.yml 의 service:[] 을 서비스명으로 수정할것 (예: service:my-app)
2. POST/PUT REST API는  template/post.ts, GET/DELETE REST API는 template/get.ts를 기반으로 생성
3. type은 type/types.ts에 생성

## DSQL을 사용할 경우
1. knex, pg 디펜던시 확보 필요 (예: yarn add knex, pg)
2. DSQL 프로비전 후 .env 파일에 dsql_endpoint 업데이트(백엔드 프로비전 리전과 같은 리전이라 가정)
3. 만약 백엔드 프로비전 리전과 동일하지 않은 경우 dsqlUtillWrapper:12 에서 리전 수정 필요
4. DSQL 사용 권한은 template.yml의 iam 역할에 기본적으로 정의 되어있음 (dsql:*)


## DSQL을 사용하지 않을 경우
1. dsql 관련 파일 삭제 필요 (dsqlUtill.ts, dsqlUtillWrapper.ts)


## 배포 
```
yarn deploy --aws-profile {프로파일}
```

## 문서화
1. info_{stage}.yml  파일 내용 수정
2. yarn doc -x {stage}