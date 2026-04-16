export const ELIGIBILITY_RULES = {
  IP: {
    designations: ["MR"],
    preTraining: [],
    preTrainingApplicableTo: "ALL",
    minYears: null,
    maxYears: null,
    noAPInNext90Days: false,
    excludeIfAlreadyTrained: true,
    preAPOnlyIfNominated: false
  },

  AP: {
    designations: ["MR", "FLM", "SLM"],
    preTraining: ["IP"],
    preTrainingApplicableTo: ["MR"],
    minYears: null,
    maxYears: null,
    noAPInNext90Days: false,
    excludeIfAlreadyTrained: true,
    preAPOnlyIfNominated: false
  },

  Capsule: {
    designations: ["MR", "FLM"],
    preTraining: [],
    preTrainingApplicableTo: "ALL",
    minYears: null,
    maxYears: null,
    noAPInNext90Days: true,
    excludeIfAlreadyTrained: true,
    preAPOnlyIfNominated: false
  },

  MIP: {
    designations: ["FLM", "SLM", "SR MANAGER"],
    preTraining: ["AP"],
    preTrainingApplicableTo: "ALL",
    minYears: null,
    maxYears: null,
    noAPInNext90Days: false,
    excludeIfAlreadyTrained: true,
    preAPOnlyIfNominated: false
  },

  Refresher: {
    designations: ["MR", "FLM"],
    preTraining: ["AP"],
    preTrainingApplicableTo: ["MR", "FLM"],
    minYears: 2,
    maxYears: 5,
    noAPInNext90Days: false,
    excludeIfAlreadyTrained: false,
    preAPOnlyIfNominated: false
  },

  "Pre-AP": {
    designations: "ALL",
    preTraining: [],
    preTrainingApplicableTo: "ALL",
    minYears: null,
    maxYears: null,
    noAPInNext90Days: false,
    excludeIfAlreadyTrained: false,
    preAPOnlyIfNominated: true
  }
};