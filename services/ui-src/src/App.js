import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import "./App.scss";
import Routes from "./Routes";
import { AppContext } from "./libs/contextLib";
import { Auth } from "aws-amplify";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import config from "./config";
import { currentUserInfo } from "./libs/user";
import { getUserByUsername, createUser } from "./libs/api";

function App({ userData }) {
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isAuthenticated, userHasAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState();
  const history = useHistory();

  useEffect(() => {
    async function onLoad() {
      // Get payload
      let payload;
      if (config.LOCAL_LOGIN === "true") {
        payload = await currentUserInfo();

        if (payload === null) {
          history.push("/login");
        }
      } else {
        try {
          const data = await Auth.currentAuthenticatedUser();

          if (!data) {
            history.push("/login");
          }

          if (data.signInUserSession) {
            payload = data.signInUserSession.idToken.payload;
          }
        } catch (error) {
          if (error !== "The user is not authenticated") {
            console.log(
              "There was an error while loading the user information.",
              error
            );
          }
        }
      }

      if (payload) {
        // Clean and set role
        const cleanRole = determineRole(payload.role);
        payload.role = cleanRole;

        const user = await getOrAddUser(payload);
        setUser(user);
        userHasAuthenticated(true);

        if (payload.isActive === true || payload.isActive === "true") {
          setIsAuthorized(true);
        }
      }
      setIsAuthenticating(false);
    }

    onLoad();
  }, [history, user]);

  const determineRole = role => {
    const roleArray = ["admin", "business", "state"];
    if (roleArray.includes(role)) {
      return role;
    }

    if (role.includes("CHIP_D_USER_GROUP_ADMIN")) {
      return "admin";
    } else if (role.includes("CHIP_D_USER_GROUP")) {
      return "state";
    } else {
      return null;
    }
  };

  async function getOrAddUser(payload) {
    if (payload.username) {
      // Check if user exists
      const data = await getUserByUsername({ username: payload.username });

      // If user doesn't exists, create user
      if (!data) {
        return await createUser(payload);
      } else {
        return data.Items[0];
      }
    }
  }

  return (
    !isAuthenticating && (
      <div className="App">
        <Header />
        <AppContext.Provider value={{ isAuthenticated, userHasAuthenticated }}>
          <div className="main">
            <Routes user={user} isAuthorized={isAuthorized} />
          </div>
        </AppContext.Provider>
        <Footer />
      </div>
    )
  );
}

export default App;
