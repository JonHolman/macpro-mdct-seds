// HELPER FUNCTIONS
import {
  sortQuestionsByNumber,
  extractAgeRanges,
  formatAnswerData,
  insertAnswer
} from "./helperFunctions";

// ENDPOINTS
import { getSingleForm, getStateForms } from "../../../libs/api.js";
import {
  CERTIFY_AND_SUBMIT_FINAL,
  CERTIFY_AND_SUBMIT_PROVISIONAL,
  UNCERTIFY
} from "../../actions/certify";

import { SUMMARY_NOTES_SUCCESS } from "../../actions/statusData";

// ACTION TYPES
export const LOAD_SINGLE_FORM = "LOAD_SINGLE_FORM";
export const UPDATE_FORM_STATUS = "UPDATE_FORM_STATUS";
export const UPDATE_ANSWER = "UPDATE_ANSWER";

// ACTION CREATORS
export const gotFormData = formObject => {
  return {
    type: LOAD_SINGLE_FORM,
    formObject
  };
};
export const gotAnswer = (answerArray, questionID) => {
  return {
    type: UPDATE_ANSWER,
    answerArray: formatAnswerData(answerArray),
    questionID
  };
};
export const updatedStatus = activeBoolean => {
  return {
    type: UPDATE_FORM_STATUS,
    activeStatus: activeBoolean
  };
};

// THUNKS
export const getFormData = (state, year, quarter, formName) => {
  return async dispatch => {
    try {
      // Call single-form endpoint
      const { questions, answers } = await getSingleForm(
        state,
        year,
        quarter,
        formName
      );

      // Call state forms endpoint for form status data
      const stateFormsByQuarter = await getStateForms(state, year, quarter);

      // Sort questions by question number
      const sortedQuestions = [...questions].sort(sortQuestionsByNumber);

      // Sort answers to get the available age ranges
      const presentAgeRanges = extractAgeRanges(answers);

      // Filter status data for single form
      const singleFormStatusData = stateFormsByQuarter.find(
        ({ form }) => form === formName
      );
      // Final payload for redux
      const allFormData = {
        answers: answers,
        questions: sortedQuestions,
        statusData: singleFormStatusData,
        tabs: [...presentAgeRanges]
      };
      // Dispatch action creator to set data in redux
      dispatch(gotFormData(allFormData));
    } catch (error) {
      console.log("Error:", error);
      console.dir(error);
    }
  };
};

export const disableForm = activeBoolean => {
  return dispatch => {
    dispatch(updatedStatus(activeBoolean));
  };
};

// INITIAL STATE
const initialState = {
  questions: [],
  answers: [],
  statusData: {},
  tabs: []
};

// REDUCER
export default (state = initialState, action) => {
  switch (action.type) {
    case UPDATE_ANSWER:
      return {
        ...state,
        answers: insertAnswer(
          state.answers,
          action.answerArray,
          action.questionID
        )
      };
    case LOAD_SINGLE_FORM:
      return {
        ...state,
        questions: action.formObject.questions,
        answers: action.formObject.answers,
        statusData: action.formObject.statusData,
        tabs: action.formObject.tabs
      };
    case UPDATE_FORM_STATUS:
      return {
        ...state,
        not_applicable: action.activeStatus
      };
    case CERTIFY_AND_SUBMIT_FINAL: // needs updating since the shape of the initial state has changed
      return {
        ...state,
        status: "final",
        last_modified_by: action.username,
        last_modified: new Date().toISOString() // Need to update this with coming soon helper function
      };
    case CERTIFY_AND_SUBMIT_PROVISIONAL:
      return {
        ...state,
        statusData: {
          ...state.statusData,
          status: "Provisional Data Certified and Submitted",
          status_date: new Date().toISOString().substring(0, 10), // Need to update this with coming soon helper function
          status_id: 3,
          status_modified_by: action.userName,
          last_modified_by: action.userName,
          last_modified: new Date().toISOString().substring(0, 10) // Need to update this with coming soon helper function
        }
      };
    case SUMMARY_NOTES_SUCCESS:
      return {
        ...state,
        statusData: {
          ...state.statusData,
          state_comments: action.tempStateComments
        }
      };
    case UNCERTIFY:
      return {
        ...state,
        statusData: {
          ...state.statusData,
          status: "In Progress",
          status_id: 2,
          status_modified_by: action.userName,
          last_modified_by: action.userName,
          last_modified: new Date().toISOString().substring(0, 10), // Need to update this with coming soon helper function
          status_date: new Date().toISOString().substring(0, 10) // Need to update this with coming soon helper function
        }
      };
    default:
      return state;
  }
};
