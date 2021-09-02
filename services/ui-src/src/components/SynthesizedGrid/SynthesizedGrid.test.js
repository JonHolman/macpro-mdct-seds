import React from "react";
import { mount } from "enzyme";
import TabContainer from "../TabContainer/TabContainer";
import configureStore from "redux-mock-store";
import { Provider } from "react-redux";
import currentFormMock_64_21E from "../../provider-mocks/currentFormMock_64_21E.js";
const mockStore = configureStore([]);

describe("Test SynthesizedGrid.js", () => {
  let store;
  let wrapper;

  beforeEach(() => {
    store = mockStore(currentFormMock_64_21E);
    wrapper = mount(
      <Provider store={store}>
        <TabContainer />
      </Provider>
    );
  });
  // Synthesied Grid should have all of the right FPL ranges in the header row
  test("Check for all top headers", () => {
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /% of FPL 0-133/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /% of FPL 134-200/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /% of FPL 201-250/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /% of FPL 251-300/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /% of FPL 301-317/
    );
  });
  // Synthesized Grid should have all three row headers
  test("Check for all side headers", () => {
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /A. Fee-for-Service/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /B. Managed Care Arrangements/
    );
    expect(wrapper.find("GridWithTotals").at(4).text()).toMatch(
      /C. Primary Care Case Management/
    );
  });

  // There should only be 6 grid with totals in the mock form
  test("Check number of gridwithtotal elements", () => {
    expect(wrapper.find(".grid-with-totals").length).toBe(6);
  });
  // Check the math for the synthesized grid
  // test("Check synthesized table values for correct math", () => {
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(1)
  //       .find("td")
  //       .at(0)
  //       .find("span")
  //       .text()
  //   ).toMatch(/61.0/);
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(1)
  //       .find("td")
  //       .at(5)
  //       .text()
  //   ).toMatch("0");
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(3)
  //       .find("td")
  //       .at(2)
  //       .find("span")
  //       .text()
  //   ).toMatch("7.4");
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(3)
  //       .find("td")
  //       .at(5)
  //       .text()
  //   ).toMatch("0");
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(4)
  //       .find("td")
  //       .at(0)
  //       .text()
  //   ).toMatch("0");
  //   expect(
  //     wrapper
  //       .find("GridWithTotals")
  //       .at(4)
  //       .find("tr")
  //       .at(4)
  //       .find("td")
  //       .at(5)
  //       .text()
  //   ).toMatch("0");
  // });
});
