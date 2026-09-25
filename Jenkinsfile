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

        HELM_RELEASE   = "oan-dashboards"
        HELM_NAMESPACE = "oan"
        HELM_CHART_DIR = "helm/oan-dashboards"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('ECR Login') {
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-ecr-creds']]) {
                    sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
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

        stage('Deploy (oan namespace)') {
            // develop -> dev cluster, staging -> staging cluster; other branches only
            // build and push. Each credential is a kubeconfig for the oan:oan-ci
            // service account created by deploy/k8s/oan-bootstrap.yaml.
            when {
                beforeAgent true
                anyOf {
                    branch 'develop'
                    branch 'staging'
                }
            }
            agent { label 'vpn-agent2' }
            environment {
                KUBECONFIG_CREDENTIAL = "${env.BRANCH_NAME == 'staging' ? 'oan-staging-kubeconfig' : 'oan-dev-kubeconfig'}"
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
                        # the Service, so a dashboards build that cannot reach the
                        # registry dashboard services fails here, not for users.
                        echo "=== oan-dashboards smoke test ==="
                        kubectl exec -n ${HELM_NAMESPACE} deploy/${HELM_RELEASE} -- node -e "const base = 'http://${HELM_RELEASE}.${HELM_NAMESPACE}'; (async () => { const h = await fetch(base + '/api/health'); if (!h.ok) throw new Error('health ' + h.status); const r = await fetch(base + '/api/charts?charts=farmerKpis,farmersByRegion,farmersByZone,landTenureSplit,registryTrendByMonth'); const j = await r.json(); console.log(JSON.stringify(j.summary)); const bad = Object.values(j.data || {}).filter(c => !c.success).map(c => c.chartName + ': ' + c.error); if (!r.ok || bad.length) throw new Error('charts failed: ' + bad.join('; ')); })().catch(e => { console.error(e.message); process.exit(1); })"
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
