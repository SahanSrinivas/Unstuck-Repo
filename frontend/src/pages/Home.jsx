import React from "react";
import Navbar from "../components/marketing/Navbar";
import Footer from "../components/marketing/Footer";
import Hero from "../components/marketing/Hero";
import HowItWorks from "../components/marketing/HowItWorks";
import Specialization from "../components/marketing/Specialization";
import Pricing from "../components/marketing/Pricing";
import WhyDifferent from "../components/marketing/WhyDifferent";
import Testimonials from "../components/marketing/Testimonials";
import TutorRecruit from "../components/marketing/TutorRecruit";
import FinalCTA from "../components/marketing/FinalCTA";

export default function Home() {
  return (
    <div className="App" data-testid="page-home">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Specialization />
        <Pricing />
        <WhyDifferent />
        <Testimonials />
        <TutorRecruit />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
