pipeline {
    agent {
        node {
            label 'agent-dev'
        }
    }

    environment {
        APP_NAME        = 'lrt-virtualtour'
        ENV             = 'Development'
        VER             = 'alpha'
        APP_SERVER      = '192.168.64.12'
        CONT_PORT       = '5011'
        SSH_USER        = 'devops-lrt'
        GIT_URL         = 'https://gitdev.kai.id/lrt-app/lrt-virtualtour.git'
        GIT_BRANCH      = 'dev-jenkins'
        HARBOR_REGISTRY = 'hub.kai.id/lrt'
        DEPLOY_PATH     = "/opt/${APP_NAME}"
        COMPOSE_FILE    = 'docker-compose.dev.yml'
        STACK_NAME      = "${APP_NAME}"
        LEGACY_COMPOSE_PROJECT = 'lrt-dev-virtualtour'
    }

    stages {
        stage('Checkout Git') {
            steps {
                git branch: "${GIT_BRANCH}",
                    credentialsId: 'devops-lrt-gitlab',
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
                            // error "Quality Gate failed: ${qg.status}"
                        }
                    }
                }
            }
        }

        stage('Build Dev') {
            steps {
                echo 'Build and push image'
                script {
                    sh """
                        cp /var/filebrowser/root/${ENV}/${APP_NAME}/.env ${WORKSPACE}/
                        sed -i 's/\\r\$//' ${WORKSPACE}/.env
                        sudo chmod 777 -R ${WORKSPACE}
                        sudo docker build -t ${HARBOR_REGISTRY}/${APP_NAME}:${TAG} .
                    """
                    withCredentials([usernamePassword(
                        credentialsId: 'harbor-creds',
                        usernameVariable: 'USERNAME_HARBOR',
                        passwordVariable: 'PASSWORD_HARBOR'
                    )]) {
                        sh """
                            echo \$PASSWORD_HARBOR | sudo docker login -u \$USERNAME_HARBOR --password-stdin hub.kai.id
                            sudo docker push ${HARBOR_REGISTRY}/${APP_NAME}:${TAG}
                        """
                    }
                }
            }
        }

        stage('Deploy Dev') {
            steps {
                echo "Deploy to dev server ${APP_SERVER}"
                script {
                    def imageRef = "${HARBOR_REGISTRY}/${APP_NAME}:${TAG}"
                    withCredentials([usernamePassword(
                        credentialsId: 'harbor-creds',
                        usernameVariable: 'USERNAME_HARBOR',
                        passwordVariable: 'PASSWORD_HARBOR'
                    )]) {
                        sh """
                            ssh ${SSH_USER}@${APP_SERVER} 'sudo mkdir -p ${DEPLOY_PATH} && sudo chmod -R 777 ${DEPLOY_PATH}/'
                            scp ${WORKSPACE}/${COMPOSE_FILE} ${SSH_USER}@${APP_SERVER}:${DEPLOY_PATH}/${COMPOSE_FILE}
                            scp ${WORKSPACE}/.env ${SSH_USER}@${APP_SERVER}:${DEPLOY_PATH}/.env

                            ssh ${SSH_USER}@${APP_SERVER} '
                                set -eu
                                cd ${DEPLOY_PATH}
                                sed -i "s/\\r\$//" .env
                                if grep -q "^LRT_VIRTUALTOUR_IMAGE=" .env; then
                                    sed -i "s|^LRT_VIRTUALTOUR_IMAGE=.*|LRT_VIRTUALTOUR_IMAGE=${imageRef}|" .env
                                else
                                    echo "LRT_VIRTUALTOUR_IMAGE=${imageRef}" >> .env
                                fi
                                if grep -q "^VIRTUALTOUR_HTTP_PORT=" .env; then
                                    sed -i "s|^VIRTUALTOUR_HTTP_PORT=.*|VIRTUALTOUR_HTTP_PORT=${CONT_PORT}|" .env
                                else
                                    echo "VIRTUALTOUR_HTTP_PORT=${CONT_PORT}" >> .env
                                fi
                                if grep -q "^DATABASE_URL=" .env && ! grep -qE "^DATABASE_URL=[^@]+@postgres:5432" .env; then
                                    echo "Normalisasi DATABASE_URL ke postgres:5432 (network internal stack)"
                                    sed -i -E "s|^(DATABASE_URL=[a-zA-Z]+://[^@]+@)[^/?]+|\\1postgres:5432|" .env
                                fi
                                set -a && . ./.env && set +a
                                echo "${PASSWORD_HARBOR}" | sudo docker login -u "${USERNAME_HARBOR}" --password-stdin hub.kai.id
                                sudo docker compose --project-name ${LEGACY_COMPOSE_PROJECT} -f ${COMPOSE_FILE} down --remove-orphans 2>/dev/null || true
                                sudo -E docker stack deploy --resolve-image=always --with-registry-auth -c ${COMPOSE_FILE} ${STACK_NAME}
                                echo "Waiting for postgres..."
                                ready=0
                                postgres_id=""
                                for i in \$(seq 1 30); do
                                    postgres_id="\$(sudo docker ps -q -f name=${STACK_NAME}_postgres | head -n 1)"
                                    if [ -n "\$postgres_id" ] && sudo docker exec "\$postgres_id" pg_isready -U "\${POSTGRES_USER}" -d "\${POSTGRES_DB}" >/dev/null 2>&1; then
                                        ready=1
                                        break
                                    fi
                                    sleep 5
                                done
                                if [ "\$ready" -ne 1 ]; then
                                    echo "Postgres did not become ready in time" >&2
                                    exit 1
                                fi
                                app_id="\$(sudo docker ps -q -f name=${STACK_NAME}_virtualtour -f status=running | head -n 1)"
                                if [ -n "\$app_id" ]; then
                                    echo "Migration via container aplikasi yang sudah berjalan, tanpa veth baru"
                                    sudo docker exec "\$app_id" npx prisma migrate deploy
                                else
                                    echo "Container aplikasi belum jalan, migration lewat network namespace PostgreSQL"
                                    migrate_url="\$(printf '%s' "\${DATABASE_URL}" | sed -E 's#@[^/?]+#@127.0.0.1:5432#')"
                                    sudo docker run --rm --network "container:\${postgres_id}" \\
                                        -e DATABASE_URL="\$migrate_url" \\
                                        ${imageRef} \\
                                        npx prisma migrate deploy
                                fi
                                sudo -E docker stack deploy --resolve-image=always --with-registry-auth -c ${COMPOSE_FILE} ${STACK_NAME}
                                sudo docker stack services ${STACK_NAME}
                            '
                        """
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
            echo "Deploy dev berhasil ke http://${APP_SERVER}:${CONT_PORT}"
        }
        failure {
            echo 'Deploy dev gagal'
        }
    }
}
