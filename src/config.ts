import * as core from '@actions/core'

const MAX_TIMEOUT = 300

export interface WorkflowConfig {
  graphiteToken: string
  endpoint: string
  timeout: number
}

/**
 * This function parses the configuration from the action inputs.
 */
export function parseConfig(): WorkflowConfig {
  const graphiteToken = core.getInput('graphite_token', { required: true })
  const endpoint = core.getInput('endpoint', { required: true })
  const timeoutStr = core.getInput('timeout', { required: true })

  const timeout = parseInt(timeoutStr, 10)
  if (isNaN(timeout) || timeout <= 0 || timeout >= MAX_TIMEOUT) {
    throw new Error(
      `Timeout must be a positive integer not exceeding ${MAX_TIMEOUT} seconds`
    )
  }

  return { graphiteToken, endpoint, timeout }
}
