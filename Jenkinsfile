// OAN Dashboards: build the image, push it to ECR, and deploy develop -> dev and
// staging -> staging with Helm. See docs/deployment.md.
//
// Image (the OAN registry naming, eoan/<repository>/<image>):
// eoan/oan_dashboards/oan-dashboards:<Chart.yaml appVersion>-<branch>.<build number>, e.g.
// 0.0.0-develop.42; the first push creates the ECR repository. develop also packages
// helm/oan-dashboards with that image pinned by digest, as 0.0.0-develop.<commit count>
// (oan-helm scripts/ci/package_chart.py), deploys that archive, and publishes the same
// archive to repository/develop/ of oan-helm (scripts/ci/publish_chart.py).
//
// Jenkins credentials:
//   aws-ecr-creds        AWS keys with ECR create-repository and push on eoan/oan_dashboards/*
//   oan-helm-fork-token  Username + token with push access to oan-helm (shared with the registries)
pipeline {
    // On-demand build agents (private subnet, ECR through the NAT); deploy runs on oan-ci-deploy.
    agent { label 'oan-ci-build' }

    options {
        disableConcurrentBuilds()
        // Agents are on-demand machines: if one is lost mid-build, run the build again.
        retry(count: 2, conditions: [agent(), nonresumable()])
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        AWS_ACCOUNT_ID = "${env.AWS_ACCOUNT_ID}"   // set on the Jenkins job
        AWS_REGION     = "ap-south-1"
        ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        ECR_REPOSITORY = "eoan/oan_dashboards/oan-dashboards"
        // A Docker login of this build's own: other pipelines on the same node run
        // `docker logout` in their post steps, which would otherwise remove the
        // shared login between this build's `docker login` and `docker push`.
        DOCKER_CONFIG  = "${env.WORKSPACE}@tmp/docker-config"

        HELM_RELEASE   = "oan-dashboards"
        HELM_NAMESPACE = "commons"
        HELM_CHART_DIR = "helm/oan-dashboards"
        // develop's settings: its deploy and oan-helm's rollback command both use this overlay.
        VALUES_OVERLAY = "helm/oan-dashboards/values-dev.yaml"
        // Release records in ConfigMaps: the deploy identity has no read access to
        // Secrets in commons (deploy/k8s/commons-deploy-rbac.yaml).
        HELM_DRIVER    = "configmap"

        OAN_HELM_FORK_CRED_ID = "oan-helm-fork-token"
        OAN_HELM              = "https://github.com/Centre-for-Open-Societal-Systems/oan-helm.git"
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
                    // checkout scm does not always export GIT_COMMIT: resolve the workspace revision.
                    env.SOURCE_COMMIT = sh(returnStdout: true, script: 'git rev-parse --verify HEAD').trim()
                    def appVersion = sh(returnStdout: true,
                                        script: 'sed -n "s/^appVersion: *//p" "$HELM_CHART_DIR/Chart.yaml" | tr -d \'"\'').trim()
                    if (!(appVersion ==~ /\d+\.\d+\.\d+/)) {
                        error("${env.HELM_CHART_DIR}/Chart.yaml appVersion '${appVersion}' is not N.N.N")
                    }
                    // <version>-<branch>.<build>: a branch name may hold characters a tag may not.
                    def branch = (env.BRANCH_NAME ?: 'local').toLowerCase().replaceAll(/[^a-z0-9.]+/, '-')
                    env.IMAGE_TAG = "${appVersion}-${branch}.${env.BUILD_NUMBER}"
                    currentBuild.description = "image ${env.IMAGE_TAG}"
                    def image = "${ECR_REGISTRY}/${ECR_REPOSITORY}"
                    // develop and staging also move a tag of their own name, so the
                    // latest image of each environment is easy to find.
                    def moving = (env.BRANCH_NAME in ['develop', 'staging']) ? "-t ${image}:${env.BRANCH_NAME}" : ''
                    // Agents start with an empty Docker cache: reuse layers from the branch image in ECR
                    // (develop for other branches), which carries inline cache metadata.
                    def cacheFrom = "${image}:${env.BRANCH_NAME in ['develop', 'staging'] ? env.BRANCH_NAME : 'develop'}"
                    sh """
                        docker build \
                            --build-arg BUILDKIT_INLINE_CACHE=1 --cache-from ${cacheFrom} \
                            --label org.opencontainers.image.revision=${env.SOURCE_COMMIT} \
                            --label org.opencontainers.image.ref.name=${env.BRANCH_NAME} \
                            -t ${image}:${env.IMAGE_TAG} ${moving} .
                        docker push ${image}:${env.IMAGE_TAG}
                        ${moving ? "docker push ${image}:${env.BRANCH_NAME}" : ''}
                    """
                }
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-ecr-creds']]) {
                    sh '''
                        set -eu
                        digest=$(aws ecr describe-images --region "$AWS_REGION" --repository-name "$ECR_REPOSITORY" \
                          --image-ids "imageTag=$IMAGE_TAG" --query 'imageDetails[0].imageDigest' --output text)
                        case "$digest" in sha256:*) ;; *) echo "no digest for $ECR_REPOSITORY:$IMAGE_TAG" >&2; exit 1 ;; esac
                        mkdir -p build-outcomes
                        # oan-helm package_chart.py: values path, repository, tag@digest.
                        printf 'image\\t%s\\t%s@%s\\n' "$ECR_REGISTRY/$ECR_REPOSITORY" "$IMAGE_TAG" "$digest" \
                          > build-outcomes/images.tsv
                        cat build-outcomes/images.tsv
                    '''
                }
                stash name: 'images', includes: 'build-outcomes/images.tsv'
            }
        }

        stage('Release') {
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
            // The deploy agent has helm, git and python3 for the oan-helm scripts.
            agent { label 'oan-ci-deploy' }
            environment {
                KUBECONFIG_CREDENTIAL = "${env.BRANCH_NAME == 'staging' ? 'staging-farmer-kubeconfig' : 'gen2-dev-kubeconfig'}"
                PUBLIC_HOST           = "${env.BRANCH_NAME == 'staging' ? 'oan-dashboard.oanstaging.com' : 'oan-dashboard-development.oanstaging.com'}"
                // The A2C platform the Access to Credit dashboard reads (its public
                // charts API), always through A2C's Kong gateway, never the backend
                // host directly. The gateway exposes the REST API as /v1/..., hence
                // the charts path. Empty hides that dashboard: staging has no A2C
                // gateway reachable from its cluster yet.
                A2C_DASHBOARD_API_URL         = "${env.BRANCH_NAME == 'staging' ? '' : 'https://a2c-develop-gateway.oanstaging.com'}"
                A2C_DASHBOARD_API_CHARTS_PATH = "${env.BRANCH_NAME == 'staging' ? '' : '/v1/charts'}"
                // The grievance service the Grievance Redress dashboard reads (its
                // public charts API, at the default /api/v1/charts). Empty hides that
                // dashboard: staging has no grievance deploy reachable yet.
                GRIEVANCE_DASHBOARD_API_URL   = "${env.BRANCH_NAME == 'staging' ? '' : 'https://grievance-dev.oanstaging.com'}"
                // develop's values above are also in values-dev.yaml, which its deploy uses: keep them in step.
            }
            stages {
                stage('Prepare') {
                    steps {
                        checkout scm
                        sh 'rm -rf build-outcomes built-chart .oan-helm'
                        unstash 'images'
                    }
                }

                stage('Package chart') {
                    // develop: the chart with this build's image written into its values. The deploy
                    // installs this archive and the publish stage adds the same file to oan-helm.
                    when { branch 'develop' }
                    steps {
                        script {
                            env.CHART_ARCHIVE = sh(returnStdout: true, script: '''
                                set -eu
                                # The chart version is the commit count, so it needs the full history.
                                if [ "$(git rev-parse --is-shallow-repository)" = true ]; then git fetch -q --unshallow; fi
                                git clone -q --depth 1 --filter=blob:none --sparse "$OAN_HELM" .oan-helm
                                git -C .oan-helm sparse-checkout set scripts/ci
                                source_repository=$(git config --get remote.origin.url |
                                  sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\\.git$##')
                                python3 .oan-helm/scripts/ci/package_chart.py \
                                  --chart "$HELM_CHART_DIR" --images build-outcomes/images.tsv --output built-chart \
                                  --source-repository "$source_repository" --source-commit "$SOURCE_COMMIT" \
                                  --subject "$(git log -1 --pretty=%s)" --release "$HELM_RELEASE" \
                                  --namespace "$HELM_NAMESPACE" --overlay "$VALUES_OVERLAY" --branch develop
                            ''').trim().readLines().last()
                        }
                        sh 'helm lint "$CHART_ARCHIVE" -f "$VALUES_OVERLAY"'
                        archiveArtifacts artifacts: 'built-chart/*.tgz,build-outcomes/images.tsv'
                    }
                }

                stage('Deploy (commons namespace)') {
                    steps {
                        script {
                            // This build's tag@digest. develop's archive already carries it.
                            env.IMAGE_REF = sh(returnStdout: true, script: 'cut -f3 build-outcomes/images.tsv').trim()
                        }
                        withCredentials([file(credentialsId: env.KUBECONFIG_CREDENTIAL, variable: 'KUBECONFIG')]) {
                            sh """
                                set -e
                                # A2C is read only through its Kong gateway. Before deploying,
                                # prove the configured URL is answered by Kong (Via: kong), not
                                # straight from the backend, and that the charts route is live:
                                # 200, or 401/403 once the gateway enforces the dashboards' key
                                # (this check holds no key; the smoke test below uses the real one).
                                if [ -n "${A2C_DASHBOARD_API_URL}" ]; then
                                    echo "=== A2C gateway check ==="
                                    A2C_HEADERS=\$(curl -sS -m 20 -o /dev/null -D - "${A2C_DASHBOARD_API_URL}${A2C_DASHBOARD_API_CHARTS_PATH}/a2cKpis")
                                    echo "\$A2C_HEADERS" | grep -iE '^(HTTP/|via:)'
                                    echo "\$A2C_HEADERS" | grep -qiE '^HTTP/[0-9.]+ (200|401|403)' || { echo "A2C charts did not answer at ${A2C_DASHBOARD_API_URL}${A2C_DASHBOARD_API_CHARTS_PATH}"; exit 1; }
                                    echo "\$A2C_HEADERS" | grep -qiE '^via:.*kong' || { echo "${A2C_DASHBOARD_API_URL} does not go through Kong"; exit 1; }
                                fi
                                # The grievance charts must be live before a build that shows them
                                # rolls: 200 from the service, or 401/403 from a Kong gateway that
                                # enforces the dashboards' key (the smoke test proves the key).
                                if [ -n "${GRIEVANCE_DASHBOARD_API_URL}" ]; then
                                    echo "=== Grievance charts check ==="
                                    GRV_HEADERS=\$(curl -sS -m 20 -o /dev/null -D - "${GRIEVANCE_DASHBOARD_API_URL}/api/v1/charts/grvKpis")
                                    echo "\$GRV_HEADERS" | grep -iE '^(HTTP/|via:)'
                                    if ! echo "\$GRV_HEADERS" | grep -qiE '^HTTP/[0-9.]+ 200'; then
                                        echo "\$GRV_HEADERS" | grep -qiE '^HTTP/[0-9.]+ (401|403)' && echo "\$GRV_HEADERS" | grep -qiE '^via:.*kong' \
                                            || { echo "Grievance charts did not answer at ${GRIEVANCE_DASHBOARD_API_URL}/api/v1/charts"; exit 1; }
                                    fi
                                fi
                                if [ "${env.BRANCH_NAME}" = develop ]; then
                                    # The packaged archive with develop's overlay: exactly what
                                    # oan-helm's rollback command for this version runs.
                                    helm upgrade --install ${HELM_RELEASE} "${env.CHART_ARCHIVE}" -n ${HELM_NAMESPACE} \
                                        -f ${VALUES_OVERLAY} --wait --timeout 10m
                                else
                                    cat > /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml <<EOF
image:
  repository: ${ECR_REGISTRY}/${ECR_REPOSITORY}
  tag: "${env.IMAGE_REF}"
ingress:
  public:
    enabled: true
    host: ${PUBLIC_HOST}
dashboardServices:
  A2C_DASHBOARD_API_URL: "${A2C_DASHBOARD_API_URL}"
  A2C_DASHBOARD_API_CHARTS_PATH: "${A2C_DASHBOARD_API_CHARTS_PATH}"
  GRIEVANCE_DASHBOARD_API_URL: "${GRIEVANCE_DASHBOARD_API_URL}"
serviceKeysSecret: oan-dashboards-service-keys
EOF
                                    helm upgrade --install ${HELM_RELEASE} ${HELM_CHART_DIR} -n ${HELM_NAMESPACE} \
                                        -f /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml --wait --timeout 10m
                                    rm -f /tmp/values-oan-cicd-\${BUILD_NUMBER}.yaml
                                fi

                                kubectl rollout status deployment/${HELM_RELEASE} -n ${HELM_NAMESPACE} --timeout=180s

                                # Ready only means the server answers. Load real charts through
                                # the Service (API server proxy; the role allows only this
                                # Service), so a dashboards build that cannot reach the
                                # dashboard services fails here, not for users.
                                echo "=== oan-dashboards smoke test ==="
                                SVC=/api/v1/namespaces/${HELM_NAMESPACE}/services/${HELM_RELEASE}:http/proxy
                                kubectl get --raw "\$SVC/api/health"; echo
                                SMOKE_CHARTS=
                                if [ -n "${A2C_DASHBOARD_API_URL}" ]; then SMOKE_CHARTS=a2cKpis,a2cFilterLocations; fi
                                if [ -n "${GRIEVANCE_DASHBOARD_API_URL}" ]; then SMOKE_CHARTS=\${SMOKE_CHARTS:+\$SMOKE_CHARTS,}grvKpis,grvFilterRegions; fi
                                CHARTS=\$(kubectl get --raw "\$SVC/api/charts?charts=\$SMOKE_CHARTS")
                                echo "\$CHARTS" | grep -o '"summary":{[^}]*}'
                                if ! echo "\$CHARTS" | grep -q '"failed":0'; then
                                    echo "charts failed:"
                                    echo "\$CHARTS" | grep -o '"chartName":"[^"]*","success":false[^}]*' || true
                                    exit 1
                                fi
                                echo "Deployed ${HELM_RELEASE} ${env.IMAGE_REF} -> https://${PUBLIC_HOST}"
                            """
                        }
                    }
                }

                stage('Publish chart to oan-helm') {
                    // develop: adds the deployed archive to repository/develop/ of oan-helm (its workflow
                    // then updates the index, CHANGELOG.md and the rollback history). A failure leaves the
                    // build UNSTABLE: the image is in ECR and dev already runs it.
                    when { branch 'develop' }
                    steps {
                        catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                            withCredentials([usernamePassword(credentialsId: env.OAN_HELM_FORK_CRED_ID, usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                                sh '''
                                    set +e
                                    # 4: a rerun of this commit, already published.
                                    python3 .oan-helm/scripts/ci/publish_chart.py "$CHART_ARCHIVE"
                                    status=$?
                                    [ "$status" -eq 4 ] && exit 0
                                    exit "$status"
                                '''
                            }
                        }
                    }
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
