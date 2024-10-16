import * as core from '@actions/core'

export interface WorkflowConfig {
  graphiteToken: string
  endpoint: string
  timeout: number
}

export function validateAndParseInputs(): WorkflowConfig {
  const graphiteToken = core.getInput('graphite_token', { required: true })
  const endpoint = core.getInput('endpoint', { required: true })
  const timeoutStr = core.getInput('timeout', { required: true })

  const timeout = parseInt(timeoutStr, 10)
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error('timeout must be a positive integer')
  }

  return { graphiteToken, endpoint, timeout }
}
