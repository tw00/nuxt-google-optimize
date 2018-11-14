module.exports = {

  devNoCookie: (config) => {
    config.devResetCookie = true;
  },

  devForceNoExperiment: (config) => {
    config.devResetCookie = true;
    config.experiments.forEach((item, index) => {
      config.experiments[index].weight = 0;
    })
  },

  devForceExperimentAndVariant: (config, expName, variantIndex, sectionIndex = 0) => {

    // TODO: Support non MVT

    config.devResetCookie = true;
    config.experiments.forEach((exp, idxExp) => {
      config.experiments[idxExp].weight = 0;
      if ( exp.name === expName ) {
        config.experiments[idxExp].weight = 1;

        config.experiments[idxExp].sections.forEach((section, idxSection) => {
          config.experiments[idxExp].sections[idxSection].variants.map(item => {
            item.weight = 0
            return item;
          })
        })

        if( variantIndex >= config.experiments[idxExp].sections[sectionIndex].variants.length ) {
          console.log('debugForceExperiment: Invalid variant Index', variantIndex);
          return;
        }

        config.experiments[idxExp].sections[sectionIndex].variants[variantIndex].weight = 1;
      }
    })
  },

  devForceExperiment: (config, expName) => {
    config.devResetCookie = true;
    config.experiments.forEach((exp, idxExp) => {
      config.experiments[idxExp].weight = 0;
      if ( exp.name === expName ) {
        config.experiments[idxExp].weight = 1;
      }
    })
  }

}
