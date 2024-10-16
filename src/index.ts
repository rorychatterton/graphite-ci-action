import * as core from '@actions/core'
import * as github from '@actions/github'
import { validateAndParseInputs } from './config'
import { requestWorkflow } from './graphiteService'
import { handleError } from './errorHandling'

export async function run(): Promise<void> {
  try {
    if (github.context.eventName === 'workflow_dispatch') {
      core.info('Workflow dispatch event detected. Skipping Graphite checks.')
      core.setOutput('skip', false)
      return
    }

    if (github.context.payload.pull_request?.number == null) {
      core.warning(
        'No pull request number found. This may not be a pull request event.'
      )
      core.setOutput('skip', false)
      return
    }

    const config = validateAndParseInputs()
    await requestWorkflow(config)
  } catch (error) {
    handleError(error)
  }
}

run()
