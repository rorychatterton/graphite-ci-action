import * as core from '@actions/core'
import * as github from '@actions/github'
import { parseConfig } from './config'
import { requestWorkflow } from './graphiteService'

/**
 * This function checks if the current action is a pull request event.
 */
export async function checkRunIsValid(): Promise<boolean> {
  // If this is a workflow dispatch event, then we should not skip.
  if (github.context.eventName === 'workflow_dispatch') {
    core.info('Workflow dispatch event detected.')
    core.info('skip: false')
    core.setOutput('skip', false)
    return false
  }

  // If There is no pull request number, then this is not a pull request event.
  if (github.context.payload.pull_request?.number == null) {
    core.info('This action is not running on a pull request event.')
    core.info('skip: false')
    core.setOutput('skip', false)
    return false
  }

  return true
}

/**
 * This action will call Graphite.dev to validate whether it needs
 * to run the workflow or not, based upon the stack context that may have
 * triggered the run.
 */
export async function run(): Promise<void> {
  try {
    if ((await checkRunIsValid()) === false) {
      return
    }

    const config = parseConfig()
    await requestWorkflow(config)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
      core.info('skip: false')
    } else {
      core.setFailed('An unknown error occurred')
      core.info('skip: false')
    }
  }
}
