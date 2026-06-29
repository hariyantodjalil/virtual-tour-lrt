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
        GIT_URL         = 'https://gitdev.kai.id/divisi-lrt/lrt-virtualtour.git'
        GIT_BRANCH      = 'dev-jenkins'
        HARBOR_REGISTRY = 'hub.kai.id/lrt'
        DEPLOY_PATH     = "/opt/${APP_NAME}"
        COMPOSE_FILE    = 'docker-compose.dev.yml'
        PROJECT_NAME    = 'lrt-dev-virtualtour'
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
                                set -a && . ./.env && set +a
                                echo "${PASSWORD_HARBOR}" | sudo docker login -u "${USERNAME_HARBOR}" --password-stdin hub.kai.id
                                sudo docker compose --project-name ${PROJECT_NAME} --env-file .env -f ${COMPOSE_FILE} pull virtualtour
                                sudo docker compose --project-name ${PROJECT_NAME} --env-file .env -f ${COMPOSE_FILE} up -d postgres
                                sudo docker compose --project-name ${PROJECT_NAME} --env-file .env -f ${COMPOSE_FILE} run --rm virtualtour npx prisma migrate deploy
                                sudo docker compose --project-name ${PROJECT_NAME} --env-file .env -f ${COMPOSE_FILE} up -d --remove-orphans virtualtour
                                sudo docker compose --project-name ${PROJECT_NAME} --env-file .env -f ${COMPOSE_FILE} ps
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
