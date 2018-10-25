import weightedRandom from 'weighted-random'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import { onAnalyticsReady } from 'vue-analytics';

const MAX_AGE = <%= options.maxAge %>
import config from '<%= options.experimentsDir %>'

export default function (ctx, inject) {

  // Assign experiment and variant to user
  assignExperiment(ctx)

  // Google optimize integration
  googleOptimize(ctx)

  // Inject $exp
  inject('exp', ctx.experiment)
}

function assignExperiment(ctx) {

  // Choose experiment and variant
  const experiments = config.experiments;
  let experimentIndex = -1
  let experiment = {}
  let variantIndexes = []
  let classes = []

  if ( config.devResetCookie ) {
    console.log("[DEV] Resetting Experiment Cookie");
    setCookie(ctx, 'exp', '')
  }
  // Try to restore from cookie
  const cookie = getCookie(ctx, 'exp') || '' // experimentID.var1-var2
  const [cookieExp, cookieVars] = cookie.split('.')
  if (cookieExp.length) {
    // Try to find experiment with that id
    experimentIndex = experiments.findIndex(exp => exp.experimentID === cookie[0])

    // Variant indexes
    variantIndexes = cookieVars.split('-').map(v => parseInt(v))
  }

  // Choose one experiment
  const experimentWeights = experiments.map(exp => exp.weight === undefined ? 1 : exp.weight)
  let retries = experiments.length
  while (experimentIndex === -1 && retries-- > 0) {
    experimentIndex = weightedRandom(experimentWeights)
    experiment = experiments[experimentIndex]

    // Check if current user is eligible for experiment
    if (typeof experiment.isEligible === 'function') {
      if (!experiment.isEligible(ctx)) {
        // Try another one
        experimentWeights[experimentIndex] = 0
        experimentIndex = -1
      }
    }
  }

  if (experimentIndex !== -1) {
    // Validate variantIndexes against experiment (coming from cookie)
    variantIndexes = variantIndexes.filter((variantIndex, index) => experiment.sections[index].variants[variantIndex])

    if (experiment.variants && (!experiment.sections || experiment.sections === 1)) experiment.sections = [{ variants: experiment.variants }]

    while (variantIndexes.length < (experiment.sections.length)) {
      const section = experiment.sections[variantIndexes.length]
      const variantWeights = section.variants.map(variant => variant.weight === undefined ? 1 : variant.weight)
      const variantIndex = weightedRandom(variantWeights)
      variantWeights[variantIndex] = 0
      variantIndexes.push(variantIndex)
    }

    // Write exp cookie if changed
    const expCookie = experiment.experimentID + '.' + variantIndexes.join('-')
    if (cookie !== expCookie) {
      setCookie(ctx, 'exp', expCookie, experiment.maxAge)
    }

    // Compute global classes to be injected
    classes = variantIndexes.map(index => 'exp-' + experiment.name + '-' + index)
  } else {
    // No active experiment
    experiment = {}
    variantIndexes = []
    classes = []
  }

  ctx.experiment = {
    $experimentIndex: experimentIndex,
    $variantIndexes: variantIndexes,
    $activeVariants: variantIndexes.map((variantIndex, index) => experiment.sections[index].variants[variantIndex]),
    $classes: classes,
    ...experiment
  }
}

function getCookie(ctx, name) {
  if (process.server && !ctx.req) {
    return
  }

  // Get and parse cookies
  const cookieStr = process.client ? document.cookie : ctx.req.headers.cookie
  const cookies = parseCookie(cookieStr || '') || {}

  return cookies[name]
}

function setCookie(ctx, name, value, maxAge = MAX_AGE) {
  const serializedCookie = serializeCookie(name, value, {
    path: '/',
    maxAge
  })

  if (process.client) {
    // Set in browser
    document.cookie = serializedCookie
  } else if (process.server && ctx.res) {
    // Send Set-Cookie header from server side
    ctx.res.setHeader('Set-Cookie', serializedCookie)
  }
}

// https://developers.google.com/optimize/devguides/experiments
function googleOptimize({ experiment }) {
  if (process.server || !experiment || !experiment.experimentID) {
    return
  }

  onAnalyticsReady().then(() => {
    const exp = experiment.experimentID + '.' + experiment.$variantIndexes.join('-')

    window.ga('set', 'exp', exp)
  });
}
