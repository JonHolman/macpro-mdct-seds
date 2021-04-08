import React from "react";
import PropTypes from "prop-types";
import GridWithTotals from "../GridWithTotals/GridWithTotals";
import SynthesizedGrid from "../SynthesizedGrid/SynthesizedGrid";
import { sortQuestionColumns } from "../../utility-functions/sortingFunctions";

const QuestionComponent = ({ questionData, rangeID, answerData, disabled }) => {
  // Get the question ID, label and question type from the question
  const { label, question, type } = questionData;
  // Get the rows from the answers table
  const { rows, answer_entry } = answerData;

  const questionNumber = Number.parseInt(question.split("-").slice(-1));
  const questionType = type;

  // Turn the age range into a grammatically correct variable in the label
  const ageVariable = questionVariables[rangeID];
  const labelWithAgeVariable = label.replace("&&&VARIABLE&&&", ageVariable);

  // The array of rows is unordered by default. GridWithTotals requires it being ordered
  const sortedRows = sortQuestionColumns(rows);

  let tempComponent = {};
  if (sortedRows.length > 0) {
    if (questionNumber === 5) {
      tempComponent = (
        <SynthesizedGrid
          questionID={answer_entry}
          questionData={questionData}
          gridData={sortedRows}
          answerData={answerData}
        />
      );
    } else if (questionNumber > 0 && questionType === "datagridwithtotals") {
      tempComponent = (
        <GridWithTotals
          questionID={answer_entry}
          gridData={sortedRows}
          disabled={disabled}
        />
      );
    }
    else if (questionNumber > 0 && questionType === "gregridwithtotals") {
      tempComponent = (
          <GREGridWithTotals
              questionID={answer_entry}
              gridData={sortedRows}
              disabled={disabled}
          />
      );
    }
  }
  return (
    <>
      <b>
        {questionNumber}. {labelWithAgeVariable}
      </b>
      {tempComponent}
    </>
  );
};
QuestionComponent.propTypes = {
  questionData: PropTypes.object.isRequired,
  rangeID: PropTypes.string.isRequired,
  answerData: PropTypes.object.isRequired,
  disabled: PropTypes.bool.isRequired
};

export default QuestionComponent;

// NOTE: If the range_id's change, they will need to change here as well
const questionVariables = {
  "0000": "Under Age 0",
  "0001": "between the ages of 0 and 1",
  "0105": "between the ages of 1 and 5",
  "0612": "between the ages of 6 and 12",
  1318: "between the ages of 13 and 18"
};
