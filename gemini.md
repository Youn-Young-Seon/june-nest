# 프로젝트 배포 가이드: Docker Compose & Kubernetes

이 문서는 Node.js, Nginx, PostgreSQL을 사용하여 애플리케이션을 배포하는 두 가지 주요 방법, Docker Compose와 Kubernetes에 대한 설정 예시를 제공합니다.

---

## 1. Docker Compose를 이용한 배포

로컬 환경이나 단일 서버에서 여러 컨테이너를 쉽게 관리할 수 있는 방법입니다.

### 설정 파일

**`docker-compose.yml`**
```yaml
version: '3.8'

services:
  node-app:
    build: .
    container_name: node-app
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: always
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - node-app
    networks:
      - app-network

  postgres:
    image: postgres:13
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

volumes:
  postgres-data:

networks:
  app-network:
```

**`nginx.conf`**
```nginx
events { }

http {
    server {
        listen 80;

        location / {
            proxy_pass http://node-app:3000;
        }
    }
}
```

### 실행 명령어
```bash
docker-compose up --build
```

---

## 2. Kubernetes를 이용한 배포

확장 가능하고 복원력 있는 프로덕션 환경에 적합한 방법입니다.

### 리소스 매니페스트 (YAML)

**`postgres.yaml`**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_USER
          value: "myuser"
        - name: POSTGRES_PASSWORD
          value: "mypassword"
        - name: POSTGRES_DB
          value: "mydb"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - protocol: TCP
      port: 5432
      targetPort: 5432
```

**`node-app.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: node-app
  template:
    metadata:
      labels:
        app: node-app
    spec:
      containers:
      - name: node-app
        image: my-node-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: PGHOST
          value: "postgres"
        - name: PGUSER
          value: "myuser"
        - name: PGPASSWORD
          value: "mypassword"
        - name: PGDATABASE
          value: "mydb"
        - name: PGPORT
          value: "5432"
---
apiVersion: v1
kind: Service
metadata:
  name: node-app
spec:
  selector:
    app: node-app
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
```

**`nginx.yaml`**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    events { }
    http {
        server {
            listen 80;
            location / {
                proxy_pass http://node-app:3000;
            }
        }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        volumeMounts:
        - name: nginx-config-volume
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
      volumes:
      - name: nginx-config-volume
        configMap:
          name: nginx-config
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  selector:
    app: nginx
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

### 실행 명령어
```bash
# (선택) 네임스페이스 생성
kubectl create namespace myapp

# 각 리소스 배포
kubectl apply -f postgres.yaml -n myapp
kubectl apply -f node-app.yaml -n myapp
kubectl apply -f nginx.yaml -n myapp

# 상태 확인
kubectl get pods,svc -n myapp
```

---

## 3. 개념 설명: Docker vs Kubernetes

-   **Docker**: '컨테이너'라는 표준화된 소프트웨어 패키지를 만들고 실행하는 기술입니다. 레고 블록 하나를 만드는 것과 같습니다.
-   **Kubernetes**: 수많은 '컨테이너'들을 대규모 환경에서 자동으로 관리하고 조율(오케스트레이션)하는 시스템입니다. 여러 레고 블록으로 거대한 마을을 짓고 관리하는 것과 같습니다.

둘은 상호 보완적인 관계로, Docker로 만든 컨테이너를 Kubernetes가 관리하여 안정적인 서비스를 운영하게 해줍니다.
