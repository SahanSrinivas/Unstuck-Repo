import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Registration is now handled by the Email OTP tab on /login (passwordless).
export default function Register() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/login", { replace: true, state: { tab: "otp" } }); }, [navigate]);
  return null;
}
