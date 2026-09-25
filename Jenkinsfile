// OAN Dashboards: build the image, push it to ECR, and deploy develop -> dev and
// staging -> staging with Helm. See docs/deployment.md.
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        AWS_ACCOUNT_ID = "${env.AWS_ACCOUNT_ID}"   // set on the Jenkins job
        AWS_REGION     = "ap-south-1"
        ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        ECR_REPOSITORY = "openg2p/oan-dashboards"
        // A Docker login of this build's own: other pipelines on the same node run
        // `docker logout` in their post steps, which would otherwise remove the
        // shared login between this build's `docker login` and `docker push`.
        DOCKER_CONFIG  = "${env.WORKSPACE}@tmp/docker-config"

        HELM_RELEASE   = "oan-dashboards"
        HELM_NAMESPACE = "commons"
        HELM_CHART_DIR = "helm/oan-dashboards"
        // Release records in ConfigMaps: the deploy identity has no read access to
        // Secrets in commons (deploy/k8s/commons-deploy-rbac.yaml).
        HELM_DRIVER    = "configmap"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('ECR Login') {
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-ecr-creds']]) {
                    sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                    // The repository is part of the deployment: create it on the first build.
                    sh """
                        aws ecr describe-repositories --region ${AWS_REGION} --repository-names ${ECR_REPOSITORY} >/dev/null 2>&1 \
                          || aws ecr create-repository --region ${AWS_REGION} --repository-name ${ECR_REPOSITORY} \
                               --image-scanning-configuration scanOnPush=true >/dev/null \
                          || { echo "ECR repository ${ECR_REPOSITORY} is missing and aws-ecr-creds may not create it: create it once in ${AWS_REGION}"; exit 1; }
                    """
                }
            }
        }

        stage('Build & Push') {
            steps {
                script {
                    env.IMAGE_TAG = env.GIT_COMMIT.take(12)
                    def image = "${ECR_REGISTRY}/${ECR_REPOSITORY}"
                    // develop and staging also move a tag of their own name, so the
                    // latest image of each environment is easy to find.
                    def moving = (env.BRANCH_NAME in ['develop', 'staging']) ? "-t ${image}:${env.BRANCH_NAME}" : ''
                    sh """
                        docker build \
                            --label org.opencontainers.image.revision=${env.GIT_COMMIT} \
                            --label org.opencontainers.image.ref.name=${env.BRANCH_NAME} \
                            -t ${image}:${env.IMAGE_TAG} ${moving} .
                        docker push ${image}:${env.IMAGE_TAG}
                        ${moving ? "docker push ${image}:${env.BRANCH_NAME}" : ''}
                    """
                }
            }
        }

        stage('Stash chart') {
            // Deploy runs on vpn-agent2; carry only the chart over.
            steps {
                stash name: 'oan-chart', includes: "${HELM_CHART_DIR}/**"
            }
        }

        stage('Deploy (commons namespace)') {
            // develop -> dev cluster, staging -> staging cluster; other branches only
            // build and push. Same credentials as the farmer registry deploy: each is
            // a kubeconfig for far:farmer-ci on that cluster, which
            // deploy/k8s/commons-deploy-rbac.yaml lets deploy this release into
            // commons and nothing more. The release creates everything else it
            // needs, including its ECR pull secret.
            when {
                beforeAgent true
                anyOf {
                    branch 'develop'
                    branch 'staging'
                }
            }
            agent { label 'vpn-agent2' }
            environment {
                KUBECONFIG_CREDENTIAL = "${env.BRANCH_NAME == 'staging' ? 'staging-farmer-kubeconfig' : 'gen2-dev-kubeconfig'}"
                PUBLIC_HOST           = "${env.BRANCH_NAME == 'staging' ? 'oan-dashboard.oanstaging.com' : 'oan-dashboard-development.oanstaging.com'}"
            }
            steps {
                unstash 'oan-chart'
                withCredentials([file(credentialsId: env.KUBECONFIG_CREDENTIAL, variable: 'KUBECONFIG')]) {
                    sh """
                        set -e
                        cat > /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml <<EOF
image:
  repository: ${ECR_REGISTRY}/${ECR_REPOSITORY}
  tag: "${env.IMAGE_TAG}"
ingress:
  public:
    enabled: true
    host: ${PUBLIC_HOST}
EOF
                        helm upgrade --install ${HELM_RELEASE} ${HELM_CHART_DIR} -n ${HELM_NAMESPACE} \
                            -f /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml --wait --timeout 10m
                        rm -f /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml

                        kubectl rollout status deployment/${HELM_RELEASE} -n ${HELM_NAMESPACE} --timeout=180s

                        # Ready only means the server answers. Load real charts through
                        # the Service (API server proxy; the role allows only this
                        # Service), so a dashboards build that cannot reach the registry
                        # dashboard services fails here, not for users.
                        echo "=== oan-dashboards smoke test ==="
                        SVC=/api/v1/namespaces/${HELM_NAMESPACE}/services/${HELM_RELEASE}:http/proxy
                        kubectl get --raw "\$SVC/api/health"; echo
                        CHARTS=\$(kubectl get --raw "\$SVC/api/charts?charts=farmerKpis,farmersByRegion,farmersByZone,landTenureSplit,registryTrendByMonth")
                        echo "\$CHARTS" | grep -o '"summary":{[^}]*}'
                        if ! echo "\$CHARTS" | grep -q '"failed":0'; then
                            echo "charts failed:"
                            echo "\$CHARTS" | grep -o '"chartName":"[^"]*","success":false[^}]*' || true
                            exit 1
                        fi
                        echo "Deployed ${HELM_RELEASE} ${env.IMAGE_TAG} -> https://${PUBLIC_HOST}"
                    """
                }
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
            sh "docker logout ${ECR_REGISTRY} || true"
        }
    }
}
