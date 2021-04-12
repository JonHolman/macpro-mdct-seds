import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { Grid, GridContainer, Button } from "@trussworks/react-uswds";
import { Link } from "@trussworks/react-uswds";
import { Auth } from "aws-amplify";
import { saveForm } from "../../store/reducers/singleForm/singleForm";

// FontAwesome / Icons
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

const FormFooter = ({
  state,
  year,
  quarter,
  lastModified,
  saveForm,
  formAnswers
}) => {
  const [username, setUsername] = useState();

  useEffect(() => {
    const loadUserData = async () => {
      const AuthUserInfo = await Auth.currentAuthenticatedUser();
      setUsername(AuthUserInfo.username);
    };

    loadUserData();
  });

  const handleClick = () => {
    saveForm(username, formAnswers);
  };

  const quarterPath = `/forms/${state}/${year}/${quarter}`;
  return (
    <div className="formfooter" data-testid="FormFooter">
      <GridContainer>
        <Grid row>
          <Grid col={6} className="form-nav">
            <Link to={quarterPath}>
              {" "}
              <FontAwesomeIcon icon={faArrowLeft} /> Back to{" "}
              {`Q${quarter} ${year}`}
            </Link>
          </Grid>

          <Grid col={6} className="form-actions">
            <Grid row>
              <Grid col={6}> Last saved: {lastModified} </Grid>
              <Grid col={6}>
                {" "}
                <Button className="hollow" onClick={() => handleClick()}>
                  Save
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </GridContainer>
    </div>
  );
};

FormFooter.propTypes = {
  state: PropTypes.string.isRequired,
  year: PropTypes.string.isRequired,
  quarter: PropTypes.string.isRequired,
  lastModified: PropTypes.string,
  saveForm: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  lastModified: state.currentForm.statusData.last_modified,
  formAnswers: state.currentForm.answers
});

const mapDispatchToProps = {
  saveForm: saveForm
};

export default connect(mapStateToProps, mapDispatchToProps)(FormFooter);
