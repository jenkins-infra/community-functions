#!/usr/bin/env groovy

pipeline {
    agent { label 'docker' }

    stages {
        stage('Prepare Dependencies') {
            steps { sh 'make depends' }
        }

        stage('Verify') {
            steps { sh 'make check' }
            post {
                always {
                    junit '**/*/xunit.xml'
                }
            }
        }
    }
}
