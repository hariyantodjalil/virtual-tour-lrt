pipeline {
    agent {
        node {
            label 'agent-dev'
        }
    }

    environment {
        APP_NAME        = 'lrt-virtualtour'
        ENV             = 'Production'
        VER             = 'live'

        APP_SERVER      = '172.16.27.74'
        CONT_PORT       = '3000'
        SSH_USER        = 'devops-lrt'
        SSH_KEY         = '/home/devops-lrt/.ssh/id_ed25519'

        GIT_URL         = 'https://gitdev.kai.id/divisi-lrt/lrt-virtualtour.git'
        GIT_BRANCH      = 'prod'

        HARBOR_REGISTRY = 'hub.kai.id/lrt'

        DEPLOY_PATH     = "/opt/${APP_NAME}"
        COMPOSE_FILE    = 'docker-compose.prod.yml'
        STACK_NAME      = "${APP_NAME}"

        LEGACY_COMPOSE_PROJECT = 'lrt-prod-virtualtour'
    }

    stages {
        stage('Checkout Git') {
            steps {
                git branch: "${GIT_BRANCH}",
                    credentialsId: 'gitdev-divisi-lrt-lrt-virtualtour',
                    url: "${GIT_URL}"

                script {
                    def tagDescription = sh(
                        script: "git tag -l '${VER}*' | sort -V | tail -n 1",
                        returnStdout: true
                    ).trim()

                    if (tagDescription) {
                        def trimmedTag = tagDescription =~ /([^-]+)/
                        env.TAG = trimmedTag[0][0]
                    } else {
                        env.TAG = "${VER}.${env.BUILD_NUMBER}"
                    }

                    echo "TAG: ${env.TAG}"
                }
            }
        }

        stage('Code Quality Check via SonarQube') {
            steps {
                echo 'Run Sonar Scan'

                script {
                    def scannerHome = tool 'sonarqube-tool'

                    withSonarQubeEnv('sonarqube-server') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Quality Gate Check') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        def qg = waitForQualityGate()

                        if (qg.status != 'OK') {
                            echo "Quality Gate status: ${qg.status}"

                            // Saat ini tidak menghentikan pipeline.
                            // Aktifkan jika Quality Gate wajib lolos:
                            // error "Quality Gate failed: ${qg.status}"
                        }
                    }
                }
            }
        }

        stage('Prepare Deploy Key') {
            steps {
                echo 'Prepare SSH key Jenkins Agent'

                sh '''
                    set -eu
                    umask 077

                    install -d -m 700 "$HOME/.ssh"

                    if [ ! -f "$SSH_KEY" ]; then
                        echo "Membuat SSH key baru untuk Jenkins Agent"

                        ssh-keygen \
                            -t ed25519 \
                            -N "" \
                            -f "$SSH_KEY" \
                            -C "jenkins-agent-192.168.64.26"
                    else
                        echo "SSH key Jenkins Agent sudah tersedia"
                    fi

                    chmod 600 "$SSH_KEY"
                    chmod 644 "$SSH_KEY.pub"

                    echo ""
                    echo "========== PUBLIC KEY JENKINS =========="
                    cat "$SSH_KEY.pub"
                    echo "========== END PUBLIC KEY =============="
                    echo ""
                '''
            }
        }

        stage('Prepare Server Host Key') {
            steps {
                echo "Register host key server ${APP_SERVER}"

                sh '''
                    set -eu

                    install -d -m 700 "$HOME/.ssh"

                    touch "$HOME/.ssh/known_hosts"
                    chmod 600 "$HOME/.ssh/known_hosts"

                    TEMP_HOST_KEY="$(mktemp)"
                    trap 'rm -f "$TEMP_HOST_KEY"' EXIT

                    if ! ssh-keygen \
                        -F "$APP_SERVER" \
                        -f "$HOME/.ssh/known_hosts" \
                        >/dev/null 2>&1
                    then
                        echo "Mengambil host key dari $APP_SERVER"

                        ssh-keyscan \
                            -T 10 \
                            -H "$APP_SERVER" \
                            > "$TEMP_HOST_KEY"

                        if [ ! -s "$TEMP_HOST_KEY" ]; then
                            echo "Host key $APP_SERVER gagal diperoleh" >&2
                            exit 1
                        fi

                        cat "$TEMP_HOST_KEY" >> "$HOME/.ssh/known_hosts"

                        sort -u \
                            "$HOME/.ssh/known_hosts" \
                            -o "$HOME/.ssh/known_hosts"

                        chmod 600 "$HOME/.ssh/known_hosts"

                        echo "Host key $APP_SERVER berhasil ditambahkan"
                    else
                        echo "Host key $APP_SERVER sudah tersedia"
                    fi
                '''
            }
        }

        stage('Verify Server Access') {
            steps {
                echo "Tes akses Jenkins ke ${APP_SERVER}"

                sh '''
                    set -eu

                    if ! ssh \
                        -i "$SSH_KEY" \
                        -o BatchMode=yes \
                        -o ConnectTimeout=10 \
                        -o StrictHostKeyChecking=yes \
                        "$SSH_USER@$APP_SERVER" \
                        'echo "SSH OK: $(hostname) - $(whoami)"'
                    then
                        echo ""
                        echo "Akses Jenkins ke server tujuan belum aktif."
                        echo "Kirim public key berikut ke Tim DC untuk dipasang"
                        echo "ke user devops-lrt pada server 172.16.27.74:"
                        echo ""
                        echo "========== COPY PUBLIC KEY INI =========="
                        cat "$SSH_KEY.pub"
                        echo "========== END PUBLIC KEY ==============="
                        echo ""
                        exit 1
                    fi

                    echo "Akses Jenkins ke server tujuan berhasil"
                '''
            }
        }

        stage('Build Production') {
            steps {
                echo 'Build and push production image'

                script {
                    sh '''
                        set -eu

                        cp \
                            "/var/filebrowser/root/$ENV/$APP_NAME/.env" \
                            "$WORKSPACE/"

                        sed -i 's/\r$//' "$WORKSPACE/.env"

                        sudo chmod 777 -R "$WORKSPACE"

                        sudo docker build \
                            -t "$HARBOR_REGISTRY/$APP_NAME:$TAG" \
                            .
                    '''

                    withCredentials([
                        usernamePassword(
                            credentialsId: 'harbor-creds',
                            usernameVariable: 'USERNAME_HARBOR',
                            passwordVariable: 'PASSWORD_HARBOR'
                        )
                    ]) {
                        sh '''
                            set -eu

                            printf '%s' "$PASSWORD_HARBOR" |
                                sudo docker login \
                                    -u "$USERNAME_HARBOR" \
                                    --password-stdin \
                                    hub.kai.id

                            sudo docker push \
                                "$HARBOR_REGISTRY/$APP_NAME:$TAG"
                        '''
                    }
                }
            }
        }

        stage('Deploy Production') {
            steps {
                echo "Deploy ke server production ${APP_SERVER}"

                script {
                    def imageRef = "${HARBOR_REGISTRY}/${APP_NAME}:${TAG}"

                    writeFile file: 'remote-deploy.sh', text: '''#!/usr/bin/env bash

set -eu

cd "$DEPLOY_PATH"

sed -i 's/\\r$//' .env

if grep -q '^LRT_VIRTUALTOUR_IMAGE=' .env; then
    sed -i \
        "s|^LRT_VIRTUALTOUR_IMAGE=.*|LRT_VIRTUALTOUR_IMAGE=${IMAGE_REF}|" \
        .env
else
    echo "LRT_VIRTUALTOUR_IMAGE=${IMAGE_REF}" >> .env
fi

if grep -q '^VIRTUALTOUR_HTTP_PORT=' .env; then
    sed -i \
        "s|^VIRTUALTOUR_HTTP_PORT=.*|VIRTUALTOUR_HTTP_PORT=${CONT_PORT}|" \
        .env
else
    echo "VIRTUALTOUR_HTTP_PORT=${CONT_PORT}" >> .env
fi

set -a
. ./.env
set +a

echo "Menutup legacy Docker Compose jika masih ada"

sudo docker compose \
    --project-name "$LEGACY_COMPOSE_PROJECT" \
    -f "$COMPOSE_FILE" \
    down --remove-orphans 2>/dev/null || true

echo "Menjalankan Docker Stack"

sudo -E docker stack deploy \
    --resolve-image=always \
    --with-registry-auth \
    -c "$COMPOSE_FILE" \
    "$STACK_NAME"

echo "Menunggu PostgreSQL"

READY=0
NETWORK_NAME="${VIRTUALTOUR_NETWORK_NAME:-lrt-prod-virtualtour-network}"

for i in $(seq 1 30); do
    if sudo docker run \
        --rm \
        --network "$NETWORK_NAME" \
        -e PGPASSWORD="$POSTGRES_PASSWORD" \
        postgres:17-alpine \
        pg_isready \
            -h postgres \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
        >/dev/null 2>&1
    then
        READY=1
        break
    fi

    echo "Menunggu PostgreSQL: percobaan $i/30"
    sleep 5
done

if [ "$READY" -ne 1 ]; then
    echo "PostgreSQL tidak ready sampai batas waktu" >&2
    exit 1
fi

echo "Menjalankan Prisma migration"

sudo docker run \
    --rm \
    --network "$NETWORK_NAME" \
    -e DATABASE_URL="$DATABASE_URL" \
    "$IMAGE_REF" \
    npx prisma migrate deploy

echo "Deploy ulang Docker Stack"

sudo -E docker stack deploy \
    --resolve-image=always \
    --with-registry-auth \
    -c "$COMPOSE_FILE" \
    "$STACK_NAME"

echo "Status service"

sudo docker stack services "$STACK_NAME"

rm -f "$DEPLOY_PATH/remote-deploy.sh"

echo "Deployment selesai"
'''

                    sh 'chmod 700 remote-deploy.sh'

                    withEnv([
                        "IMAGE_REF=${imageRef}"
                    ]) {
                        withCredentials([
                            usernamePassword(
                                credentialsId: 'harbor-creds',
                                usernameVariable: 'USERNAME_HARBOR',
                                passwordVariable: 'PASSWORD_HARBOR'
                            )
                        ]) {
                            sh '''
                                set -eu

                                echo "Membuat direktori deploy"

                                ssh \
                                    -i "$SSH_KEY" \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -o StrictHostKeyChecking=yes \
                                    "$SSH_USER@$APP_SERVER" \
                                    "sudo mkdir -p '$DEPLOY_PATH' &&
                                     sudo chown -R \\$(id -un):\\$(id -gn) '$DEPLOY_PATH' &&
                                     sudo chmod -R 775 '$DEPLOY_PATH'"

                                echo "Mengirim Docker Compose"

                                scp \
                                    -i "$SSH_KEY" \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -o StrictHostKeyChecking=yes \
                                    "$WORKSPACE/$COMPOSE_FILE" \
                                    "$SSH_USER@$APP_SERVER:$DEPLOY_PATH/$COMPOSE_FILE"

                                echo "Mengirim file environment"

                                scp \
                                    -i "$SSH_KEY" \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -o StrictHostKeyChecking=yes \
                                    "$WORKSPACE/.env" \
                                    "$SSH_USER@$APP_SERVER:$DEPLOY_PATH/.env"

                                echo "Mengirim script deploy"

                                scp \
                                    -i "$SSH_KEY" \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -o StrictHostKeyChecking=yes \
                                    "$WORKSPACE/remote-deploy.sh" \
                                    "$SSH_USER@$APP_SERVER:$DEPLOY_PATH/remote-deploy.sh"

                                echo "Login Harbor pada server tujuan"

                                printf '%s' "$PASSWORD_HARBOR" |
                                    ssh \
                                        -i "$SSH_KEY" \
                                        -o BatchMode=yes \
                                        -o ConnectTimeout=10 \
                                        -o StrictHostKeyChecking=yes \
                                        "$SSH_USER@$APP_SERVER" \
                                        "sudo docker login \
                                            -u '$USERNAME_HARBOR' \
                                            --password-stdin \
                                            hub.kai.id"

                                echo "Menjalankan deployment"

                                ssh \
                                    -i "$SSH_KEY" \
                                    -o BatchMode=yes \
                                    -o ConnectTimeout=10 \
                                    -o StrictHostKeyChecking=yes \
                                    "$SSH_USER@$APP_SERVER" \
                                    "DEPLOY_PATH='$DEPLOY_PATH' \
                                     COMPOSE_FILE='$COMPOSE_FILE' \
                                     IMAGE_REF='$IMAGE_REF' \
                                     CONT_PORT='$CONT_PORT' \
                                     LEGACY_COMPOSE_PROJECT='$LEGACY_COMPOSE_PROJECT' \
                                     STACK_NAME='$STACK_NAME' \
                                     bash '$DEPLOY_PATH/remote-deploy.sh'"
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline selesai'
        }

        success {
            echo "Deploy production berhasil ke http://${APP_SERVER}:${CONT_PORT}"
        }

        failure {
            echo 'Deploy production gagal'
        }
    }
}