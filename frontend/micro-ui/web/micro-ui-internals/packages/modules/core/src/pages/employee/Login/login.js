import { BackButton, Dropdown, FormComposer, Loader, Toast, TextInput, RefreshIcon, Close, ViewsIcon } from "@nudmcdgnpm/digit-ui-react-components";
import PropTypes from "prop-types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import Background from "../../../components/Background";
import Header from "../../../components/Header";
import HrmsService from "../../../../../../libraries/src/services/elements/HRMS";
import { encryptAES } from "./aes";

/* set employee details to enable backward compatiable */
const setEmployeeDetail = (userObject, token) => {
  let locale = JSON.parse(sessionStorage.getItem("Digit.locale"))?.value || "en_IN";
  localStorage.setItem("Employee.tenant-id", userObject?.tenantId);
  localStorage.setItem("tenant-id", userObject?.tenantId);
  localStorage.setItem("citizen.userRequestObject", JSON.stringify(userObject));
  localStorage.setItem("locale", locale);
  localStorage.setItem("Employee.locale", locale);
  localStorage.setItem("token", token);
  localStorage.setItem("Employee.token", token);
  localStorage.setItem("user-info", JSON.stringify(userObject));
  localStorage.setItem("Employee.user-info", JSON.stringify(userObject));
};

const Login = ({ config: propsConfig, t, isDisabled }) => {
  const history = useHistory();
  const isMountedRef = useRef(true);

  const { data: cities, isLoading } = Digit.Hooks.useTenants();
  const { data: storeData, isLoading: isStoreLoading } = Digit.Hooks.useStore.getInitData();
  const { stateInfo } = storeData || {};
  const [user, setUser] = useState(null);
  const [showToast, setShowToast] = useState(null);
  const [disable, setDisable] = useState(false);
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const defaultCity = useMemo(() => cities?.find((c) => c.code === "dl.mcd") || null, [cities]);

  const fetchCaptcha = async () => {
    try {
      const timestamp = Date.now();

      

      const response = await fetch(`/user/api/captcha/image?timestamp=${timestamp}`, {
        method: "GET",
        credentials: "include",
      });

      // ✅ Read Captcha-Id from response headers
      const captchaIdFromHeader = response.headers.get("Captcha-Id");

      if (!captchaIdFromHeader) {
        console.error("Captcha-Id missing in response headers");
        return;
      }

      // Optional encryption
      const encryptedCaptchaId = encryptAES(captchaIdFromHeader);

      // Convert image to blob for display
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      setCaptchaImage(imageUrl);
      setCaptchaId(encryptedCaptchaId);
      setCaptchaValue("");

    } catch (error) {
      console.error("Failed to fetch captcha", error);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    Digit.SessionStorage.set("citizen.userRequestObject", user);
    const filteredRoles = user?.info?.roles?.filter((role) => role.tenantId === Digit.SessionStorage.get("Employee.tenantId"));
    if (user?.info?.roles?.length > 0) user.info.roles = filteredRoles;
    Digit.UserService.setUser(user);
    setEmployeeDetail(user?.info, user?.access_token);
    let redirectPath = "/digit-ui/employee";

    /* logic to redirect back to same screen where we left off  */
    if (window?.location?.href?.includes("from=")) {
      redirectPath = decodeURIComponent(window?.location?.href?.split("from=")?.[1]) || "/digit-ui/employee";
    }

    /*  RAIN-6489 Logic to navigate to National DSS home incase user has only one role [NATADMIN]*/
    if (user?.info?.roles && user?.info?.roles?.length > 0 && user?.info?.roles?.every((e) => e.code === "NATADMIN")) {
      redirectPath = "/digit-ui/employee/dss/landing/NURT_DASHBOARD";
    }
    /*  RAIN-6489 Logic to navigate to National DSS home incase user has only one role [NATADMIN]*/
    if (user?.info?.roles && user?.info?.roles?.length > 0 && user?.info?.roles?.every((e) => e.code === "STADMIN")) {
      redirectPath = "/digit-ui/employee/dss/landing/home";
    }

    history.replace(redirectPath);
  }, [user, history]);

  const onLogin = async (data) => {
    if (!data.city) {
      alert("Please Select City!");
      return;
    }

    if (!captchaValue) {
      setShowToast("Please enter captcha");
      return;
    }

    setDisable(true);

    const encryptedPassword = encryptAES(data.password);
    const encryptedCaptcha = encryptAES(data.captcha);

    const requestData = {
      ...data,
      password: encryptedPassword,
      userType: "EMPLOYEE",
      tenantId: data.city.code,
      captcha: encryptedCaptcha,
      captchaId: captchaId,
    };

    delete requestData.city;

    try {
      const { UserRequest: info, ...tokens } = await Digit.UserService.authenticate(requestData);
      Digit.SessionStorage.set("Employee.tenantId", info?.tenantId);
      setUser({ info, ...tokens });
      Digit.UserService.setUser({ info, ...tokens });

      const hrmsResponse = await HrmsService.search(info?.tenantId, { codes: info?.userName });
      const employee = hrmsResponse?.Employees?.[0];
      const zone = employee?.jurisdictions?.[0]?.zone;
      const designation = employee?.assignments?.[0]?.designation;
      const department = employee?.assignments?.[0]?.department;

      if (designation) {
        Digit.SessionStorage.set("Employee.designation", designation);
      }
      if (department) {
        Digit.SessionStorage.set("Employee.department", department);
      }
      if (zone) {
        Digit.SessionStorage.set("Employee.zone", zone);
      }
      const zon = Digit.SessionStorage.get("Employee.zone");
      console.log("=> ", zone);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorCode = err?.response?.data?.Errors?.[0]?.code;
      const errorDescription = err?.response?.data?.error_description;

      setShowToast(errorDescription || "Invalid login credentials!");

      // ✅ If captcha is wrong → refetch captcha
      if (errorCode === "CAPTCHA_INVALID" || errorDescription?.toLowerCase().includes("captcha")) {
        fetchCaptcha(); // 🔁 refresh captcha
        setCaptchaValue(""); // clear input
      }

      setTimeout(() => {
        if (isMountedRef.current) setShowToast(null);
      }, 5000);
    } finally {
      if (isMountedRef.current) setDisable(false);
    }
  };

  const closeToast = () => {
    setShowToast(null);
  };
  const isFormValid = (formData) => {
    return formData?.username && formData?.password && captchaValue && captchaImage;
  };

  const onForgotPassword = () => {
    sessionStorage.getItem("User") && sessionStorage.removeItem("User");
    history.push("/digit-ui/employee/user/forgot-password");
  };

  const [userId, password, city] = propsConfig.inputs;

  const config = [
    {
      body: [
        {
          label: t(userId.label),
          type: "custom",
          isMandatory: true,
          populators: {
            name: userId.name,
            component: (props) => (
              <input
                value={props.value}
                name={userId.name}
                onChange={(e) => props.onChange(e.target.value)}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                placeholder={t(userId.label)}
                className="w-full"
                autoComplete="off"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "8px 12px",
                  border: "1px solid black",
                  backgroundColor: "#eef2ff",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  marginBottom: "12px",
                }}
              />
            ),
          },
        },
        {
          label: t(password.label),
          type: "custom",
          isMandatory: true,
          populators: {
            name: password.name,
            component: (props) => (
              <div style={{ width: "100%", marginBottom: "12px", position: "relative" }}>
                <input
                  type={showPassword ? "text" : password.type}
                  value={props.value}
                  name={password.name}
                  onChange={(e) => props.onChange(e.target.value)}
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  placeholder={t(password.label)}
                  className="w-full"
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "8px 40px 8px 12px",
                    border: "1px solid black",
                    backgroundColor: "#eef2ff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    fontSize: "18px",
                    color: "#444",
                    background: "transparent",
                    padding: "0",
                    userSelect: "none",
                  }}
                >
                  {showPassword ? <Close /> : <ViewsIcon />}
                </span>
              </div>
            ),
          },
        },
        {
          type: "custom",
          populators: {
            name: "captcha",
            component: ({ value, onChange }) => {
              return (
                <div style={{ marginTop: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      marginBottom: "8px",
                      alignItems: "center",
                    }}
                  >
                    {/* Captcha Image Display */}
                    <div
                      style={{
                        height: "45px",
                        minWidth: "120px",
                        background: "#f2f2f2",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {captchaImage ? (
                        <img
                          src={captchaImage}
                          alt="Captcha"
                          style={{
                            height: "100%",
                            width: "100%",
                            objectFit: "contain",
                          }}
                          onError={(e) => {
                            console.error("Captcha image failed to load");
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: "12px", color: "#666" }}>Loading...</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      title="Refresh Captcha"
                      style={{
                        background: "none",
                        border: "none",
                        marginLeft: "12px",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshIcon />
                    </button>
                  </div>
                  <TextInput
                    placeholder="Enter Captcha"
                    value={value || ""}
                    onChange={(e) => {
                      setCaptchaValue(e.target.value);
                      onChange(e.target.value);
                    }}
                  />
                </div>
              );
            },
          },
        },
        {
          type: city.type,
          populators: {
            name: city.name,
            customProps: {},
            component: (props, customProps) => (
              <Dropdown
                disable
                option={cities}
                defaultProps={{ name: "i18nKey", value: "code" }}
                className="login-city-dd"
                optionKey="i18nKey"
                style={{ display: "none" }}
                selected={props.value || defaultCity}
                select={(d) => props.onChange(d)}
                t={t}
                {...customProps}
              />
            ),
          },
        },
      ],
    },
  ];

  return isLoading || isStoreLoading ? (
    <Loader />
  ) : (
    <Background>
      <div className="employeeBackbuttonAlign">
        <BackButton variant="white" style={{ borderBottom: "none" }} />
      </div>

      <FormComposer
        onSubmit={onLogin}
        isDisabled={isDisabled || disable || !captchaImage}
        noBoxShadow
        inline
        submitInForm
        config={config}
        defaultValues={{ city: defaultCity }}
        label={propsConfig.texts.submitButtonLabel}
        secondaryActionLabel={propsConfig.texts.secondaryButtonLabel}
        onSecondayActionClick={onForgotPassword}
        heading={propsConfig.texts.header}
        headingStyle={{ textAlign: "center" }}
        cardStyle={{ margin: "auto", minWidth: "408px" }}
        className="loginFormStyleEmployee"
        buttonStyle={{ maxWidth: "100%", width: "100%", backgroundColor: "#5a1166" }}
      ></FormComposer>
      {showToast && <Toast error={true} label={t(showToast)} onClose={closeToast} />}
      <div style={{ width: "100%", position: "fixed", bottom: 0, backgroundColor: "white", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", color: "black" }}>
          <a
            style={{ cursor: "pointer", fontSize: window.Digit.Utils.browser.isMobile() ? "12px" : "12px", fontWeight: "400" }}
            href="#"
            target="_blank"
          >
            UPYOG License
          </a>

          <span className="upyog-copyright-footer" style={{ margin: "0 10px", fontSize: "12px" }}>
            |
          </span>
          <span
            className="upyog-copyright-footer"
            style={{ cursor: "pointer", fontSize: window.Digit.Utils.browser.isMobile() ? "12px" : "12px", fontWeight: "400" }}
            onClick={() => {
              window.open("https://mcdonline.nic.in/", "_blank").focus();
            }}
          >
            Copyright ©️ 2025 Municipal Corporation of Delhi
          </span>
          <span className="upyog-copyright-footer" style={{ margin: "0 10px", fontSize: "12px" }}>
            |
          </span>
          <span
            className="upyog-copyright-footer"
            style={{ cursor: "pointer", fontSize: window.Digit.Utils.browser.isMobile() ? "12px" : "12px", fontWeight: "400" }}
            onClick={() => {
              window.open("https://nitcon.org/", "_blank").focus();
            }}
          >
            Designed & Developed By NITCON Ltd
          </span>
        </div>
        <div className="upyog-copyright-footer-web">
          <span
            className=""
            style={{ cursor: "pointer", fontSize: window.Digit.Utils.browser.isMobile() ? "14px" : "16px", fontWeight: "400" }}
            onClick={() => {
              window.open("https://mcdonline.nic.in/", "_blank").focus();
            }}
          >
            Copyright © 2025 Municipal Corporation of Delhi
          </span>
        </div>
      </div>
    </Background>
  );
};

Login.propTypes = {
  loginParams: PropTypes.any,
};

Login.defaultProps = {
  loginParams: null,
};

export default Login;
