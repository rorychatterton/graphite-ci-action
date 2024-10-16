import * as core from '@actions/core'
import * as github from '@actions/github'
import * as pkg from '../package.json'

interface WorkflowConfig {
  graphiteToken: string
  endpoint: string
  timeout: number
}

interface RequestBodyContext {
  kind: 'GITHUB_ACTIONS'
  repository: {
    owner: string
    name: string
  }
  pr: number
  sha: string
  ref: string
  head_ref?: string
  run: {
    workflow: string
    job: string
    run: number
  }
}

interface RequestBodyData {
  token: string
  caller: {
    name: string
    version: string
  }
  context: RequestBodyContext
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Skip Graphite checks if the event is a workflow dispatch
    if (github.context.eventName === 'workflow_dispatch') {
      core.info('Workflow dispatch event detected. Skipping Graphite checks.')
      core.setOutput('skip', false)
      return
    }

    // Skip Graphite checks if the event isn't a pull request
    if (github.context.payload.pull_request?.number == null) {
      core.warning(
        'No pull request number found. This may not be a pull request event.'
      )
      core.setOutput('skip', false)
      return
    }

    const config: WorkflowConfig = {
      graphiteToken: core.getInput('graphite_token', { required: true }),
      endpoint: core.getInput('endpoint', { required: true }),
      timeout: parseInt(core.getInput('timeout', { required: true }))
    }

    await requestWorkflow(config)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

function createRequestBody(graphiteToken: string): RequestBodyData {
  const { repo, sha, ref, runId, workflow, job, payload } = github.context

  return {
    token: graphiteToken,
    caller: {
      name: pkg.name,
      version: pkg.version
    },
    context: {
      kind: 'GITHUB_ACTIONS',
      repository: {
        owner: github.context.repo.owner,
        name: repo.repo
      },
      pr: payload.pull_request?.number ?? 0,
      sha,
      ref,
      head_ref: process.env.GITHUB_HEAD_REF,
      run: {
        workflow,
        job,
        run: runId
      }
    }
  }
}

async function requestWorkflow(config: WorkflowConfig): Promise<void> {
  const requestBody = createRequestBody(config.graphiteToken)

  try {
    const result = await fetch(`${config.endpoint}/api/v1/ci/optimizer`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(config.timeout * 1000)
    })

    if (!result.ok) {
      await handleNonOkResponse(result, requestBody)
      return
    }

    const body = (await result.json()) as { skip: boolean; reason: string }
    core.setOutput('skip', body.skip)
    core.info(body.reason)
  } catch (error) {
    core.warning(
      'Failed to make request or parse response. Skipping Graphite checks.'
    )
    if (error instanceof Error) {
      core.debug(`Error details: ${error.message}`)
    }
  }
}

async function handleNonOkResponse(
  response: Response,
  requestBody: RequestBodyData
): Promise<void> {
  const { status } = response
  const { repo } = github.context

  switch (status) {
    case 400:
      core.warning('Invalid request body. Skipping Graphite checks.')
      break
    case 401:
      core.warning('Invalid authentication. Skipping Graphite checks.')
      break
    case 402:
      core.warning(
        'Your Graphite plan does not support the CI Optimizer. Please upgrade your plan to use this feature.'
      )
      break
    default:
      core.warning(`Request body: ${JSON.stringify(requestBody)}`)
      core.warning(`Response status: ${status}`)
      core.warning(
        `Request Context: ${repo.owner}/${repo.repo}/${github.context.payload.pull_request?.number}`
      )
      core.warning(
        'Response returned a non-200 status. Skipping Graphite checks.'
      )
  }

  core.setOutput('skip', false)
}
