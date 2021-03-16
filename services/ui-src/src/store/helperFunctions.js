const sortQuestionsByNumber = (q1, q2) => {
  const q1Number = Number.parseInt(q1.question.split("-").slice(-1));
  const q2Number = Number.parseInt(q2.question.split("-").slice(-1));
  return q1Number > q2Number ? 1 : -1;
};

const selectAnswer = () => {
  // use jsonpath to format array into object
};

const formatAnswerData = answerArray => {
  const answerObject = {};

  // slice off first two elements of the array entirely
  // slice off the first two elements of each array
  // assign each value to a column named after its new index
  // return the single object
};

// ANSWERS is an ARRAY of OBJECTS

// in a given answer object I want to update:
// rows, last_modified, last_modified_by

// sorting through all the answers (AGAIN) is too much.
// Maybe theres a way to use the already sorted answers from the front end
// take that ONE object and replace that object

// it still has to be searched through by answer_entry to find where it should be place

// [
//   {
//     answer_entry: "AL-2021-1-21E-0000-01",
//     state_form: "AL-2021-1-21E",
//     question: "2021-21E-01",
//     age_range: "Under Age 0",
//     rangeId: "0000",
//     rows: [
//       {
//         col1: "",
//         col2: "% of FPL 0-133",
//         col3: "% of FPL 134-200",
//         col4: "% of FPL 201-250",
//         col5: "% of FPL 251-300",
//         col6: "% of FPL 301-317"
//       },
//       {
//         col1: "A. Fee-for-Service",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       },
//       {
//         col1: "B. Managed Care Arrangements",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       },
//       {
//         col1: "C. Primary Care Case Management",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       }
//     ],
//     last_modified: "01/15/2021",
//     last_modified_by: "seed",
//     created_date: "01/15/2021",
//     created_by: "seed"
//   },
//   {
//     answer_entry: "AL-2021-1-21E-0000-02",
//     state_form: "AL-2021-1-21E",
//     question: "2021-21E-02",
//     age_range: "Under Age 0",
//     rangeId: "0000",
//     rows: [
//       {
//         col1: "",
//         col2: "% of FPL 0-133",
//         col3: "% of FPL 134-200",
//         col4: "% of FPL 201-250",
//         col5: "% of FPL 251-300",
//         col6: "% of FPL 301-317"
//       },
//       {
//         col1: "A. Fee-for-Service",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       },
//       {
//         col1: "B. Managed Care Arrangements",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       },
//       {
//         col1: "C. Primary Care Case Management",
//         col2: null,
//         col3: null,
//         col4: null,
//         col5: null,
//         col6: null
//       }
//     ],
//     last_modified: "01/15/2021",
//     last_modified_by: "seed",
//     created_date: "01/15/2021",
//     created_by: "seed"
//   }
// ];

const extractAgeRanges = answersArray => {
  // call back for a reduce method
  const findAges = (accumulator, answer) => {
    let ageRange = answer.rangeId;

    if (accumulator[ageRange]) {
      return accumulator;
    } else {
      accumulator[ageRange] = "";
    }
    return accumulator;
  };

  // sort through the answers and return an object whose keys are the unique age ranges present
  // Extract the keys from that object and sort them
  const foundAges = Object.keys(answersArray.reduce(findAges, {})).sort();
  return foundAges;
};

export {
  sortQuestionsByNumber,
  extractAgeRanges,
  selectAnswer,
  formatAnswerData
};
