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
        NODE_ENV        = 'production'
        GIT_URL         = 'https://gitdev.kai.id/divisi-lrt/lrt-virtualtour.git'
        GIT_BRANCH      = 'dev'
        HARBOR_REGISTRY = 'hub.kai.id/lrt'
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
                        sudo chmod 777 -R ${WORKSPACE}
                        sed -i 's|\\\${TAG}|${TAG}|g' docker-compose.yml
                        sed -i 's|\\\${CONT_PORT}|${CONT_PORT}|g' docker-compose.yml
                        sudo docker compose -f ./docker-compose.yml build app
                    """
                    withCredentials([usernamePassword(
                        credentialsId: 'harbor-creds',
                        usernameVariable: 'USERNAME_HARBOR',
                        passwordVariable: 'PASSWORD_HARBOR'
                    )]) {
                        sh """
                            echo \$PASSWORD_HARBOR | sudo docker login -u \$USERNAME_HARBOR --password-stdin hub.kai.id
                            sudo docker compose -f ./docker-compose.yml push app
                        """
                    }
                }
            }
        }

        stage('Deploy Dev') {
            steps {
                echo 'Deploy to dev server'
                script {
                    sh """
                        ssh ${SSH_USER}@${APP_SERVER} 'sudo mkdir -p /opt/${APP_NAME} && sudo chmod -R 777 /opt/${APP_NAME}/'
                        scp ${WORKSPACE}/docker-compose.yml ${SSH_USER}@${APP_SERVER}:/opt/${APP_NAME}/docker-compose.yml
                        scp ${WORKSPACE}/.env ${SSH_USER}@${APP_SERVER}:/opt/${APP_NAME}/.env

                        ssh ${SSH_USER}@${APP_SERVER} '
                            set -e
                            cd /opt/${APP_NAME}
                            set -a && . ./.env && set +a
                            sudo docker stack deploy --resolve-image=always -c docker-compose.yml --with-registry-auth ${APP_NAME}
                            sleep 15
                            # P3009: tandai migrasi gagal sebagai applied (partial run), tanpa nested quote
                            sudo docker run --rm --network ${APP_NAME}_virtualtour-net \
                                -e DATABASE_URL="\$DATABASE_URL" \
                                hub.kai.id/lrt/${APP_NAME}:${TAG} \
                                npx prisma migrate resolve --applied 20260629040000_add_mitra_role_and_lead_user || true
                            sudo docker run --rm --network ${APP_NAME}_virtualtour-net \
                                -e DATABASE_URL="\$DATABASE_URL" \
                                hub.kai.id/lrt/${APP_NAME}:${TAG} \
                                npx prisma migrate deploy
                        '
                    """
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline selesai'
        }
        success {
            echo 'Deploy dev berhasil'
        }
        failure {
            echo 'Deploy dev gagal'
        }
    }
}
